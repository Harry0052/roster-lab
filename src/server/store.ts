import crypto from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { evaluateEvidence, parseEvidence, type IsolationEvidence } from "../shared/badge.ts";
import type { ProviderKind, TaskState } from "../shared/labels.ts";
import { capabilitiesFor, remoteCancel } from "./capabilities.ts";
import { transaction } from "./db.ts";
import { redact, type SecretStore } from "./secrets.ts";
import { captureInProfile, LOCAL_BROWSER_LABEL, workPage } from "./workspace-runner.ts";
import fs from "node:fs";
import path from "node:path";

const CLAIM_MS = 15 * 60 * 1000;
const APPROVAL_MS = 24 * 60 * 60 * 1000;
const MAX_ATTACHMENT = 200_000;
const PROVIDERS = new Set(["none", "simulated", "claude-duet", "openai-dot"]);
const KINDS = new Set(["send_message", "purchase", "publish", "delete_data"]);

export class DomainError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export type Deps = {
  db: DatabaseSync;
  secrets: SecretStore;
  now: () => Date;
  allowLoopbackCallbacks: boolean;
  fetchImpl: typeof fetch;
  dataDir: string;
};

type Row = Record<string, unknown>;

export class RosterStore {
  constructor(private readonly deps: Deps) {}

  nowIso(): string {
    return this.deps.now().toISOString();
  }

  createWorkspace(name: string) {
    const clean = requiredText(name, "Company name", 120);
    const id = idFor("ws");
    const now = this.nowIso();
    this.deps.db.prepare("INSERT INTO workspaces (id, name, created_at) VALUES (?, ?, ?)").run(id, clean, now);
    this.audit(id, "workspace.created", `Created company “${clean}”.`);
    return this.workspace(id);
  }

  listWorkspaces() {
    return this.deps.db
      .prepare("SELECT * FROM workspaces ORDER BY created_at ASC")
      .all()
      .map(presentWorkspace);
  }

  workspace(id: string) {
    const row = this.one("SELECT * FROM workspaces WHERE id = ?", id);
    if (!row) throw new DomainError(404, "not_found", "That company is not on this computer.");
    this.expireApprovals(id);
    return presentWorkspace(row);
  }

  updateApprovals(id: string, prefs: { send: boolean; purchase: boolean; publish: boolean; deleteData: boolean }) {
    this.workspace(id);
    this.deps.db
      .prepare(
        `UPDATE workspaces SET approval_send = ?, approval_purchase = ?, approval_publish = ?, approval_delete = ? WHERE id = ?`,
      )
      .run(bool(prefs.send), bool(prefs.purchase), bool(prefs.publish), bool(prefs.deleteData), id);
    this.audit(id, "approvals.updated", "Updated which mediated actions ask for approval.");
    return this.workspace(id);
  }

  deleteWorkspace(id: string, approvalId?: string) {
    const ws = this.workspace(id);
    if (ws.approvals.deleteData) {
      if (!approvalId) {
        const approval = this.requestApproval(id, null, "delete_data", `Delete the company “${ws.name}” from this computer, including its projects, people, tasks, and attachments.`);
        return { deleted: false, approval };
      }
      const approval = this.mustApproval(approvalId);
      if (approval.workspaceId !== id || approval.kind !== "delete_data" || approval.status !== "approved") {
        throw new DomainError(403, "approval_required", "Deleting this company needs an approval that has already been accepted.");
      }
    }
    const secretIds = this.deps.db
      .prepare(
        `SELECT c.secret_id AS secret_id FROM connections c JOIN employees e ON e.id = c.employee_id WHERE e.workspace_id = ? AND c.secret_id IS NOT NULL`,
      )
      .all(id)
      .map((row) => String(row.secret_id));
    const subSecrets = this.deps.db
      .prepare(`SELECT secret_id FROM subscriptions WHERE employee_id IN (SELECT id FROM employees WHERE workspace_id = ?)`)
      .all(id)
      .map((row) => String(row.secret_id));
    const mainSecrets = this.deps.db
      .prepare("SELECT secret_id FROM main_bots WHERE workspace_id = ? AND secret_id IS NOT NULL")
      .all(id)
      .map((row) => String(row.secret_id));
    transaction(this.deps.db, () => {
      for (const table of ["attachments", "task_events", "approvals", "tasks", "audit"]) {
        this.deps.db.prepare(`DELETE FROM ${table} WHERE workspace_id = ?`).run(id);
      }
      this.deps.db
        .prepare(`DELETE FROM subscriptions WHERE employee_id IN (SELECT id FROM employees WHERE workspace_id = ?)`)
        .run(id);
      this.deps.db
        .prepare(`DELETE FROM connections WHERE employee_id IN (SELECT id FROM employees WHERE workspace_id = ?)`)
        .run(id);
      this.deps.db
        .prepare(`DELETE FROM computers WHERE employee_id IN (SELECT id FROM employees WHERE workspace_id = ?)`)
        .run(id);
      this.deps.db.prepare("DELETE FROM employees WHERE workspace_id = ?").run(id);
      this.deps.db.prepare("DELETE FROM main_bots WHERE workspace_id = ?").run(id);
      this.deps.db.prepare("DELETE FROM projects WHERE workspace_id = ?").run(id);
      this.deps.db.prepare("DELETE FROM workspaces WHERE id = ?").run(id);
    });
    for (const secretId of [...secretIds, ...subSecrets, ...mainSecrets]) this.deps.secrets.delete(secretId);
    return { deleted: true, approval: null };
  }

  createProject(workspaceId: string, name: string, summary: string, extra?: { goal?: string; mainBotId?: string }) {
    this.workspace(workspaceId);
    const id = idFor("pr");
    const now = this.nowIso();
    const cleanName = requiredText(name, "Project name", 120);
    const goal = text(extra?.goal ?? "", 4000);
    const mainBotId = extra?.mainBotId ?? null;
    if (mainBotId) {
      const bot = this.mainBot(mainBotId);
      if (bot.workspaceId !== workspaceId) throw new DomainError(403, "cross_workspace", "That main bot is in another company.");
    }
    this.deps.db
      .prepare(
        `INSERT INTO projects (id, workspace_id, name, summary, goal, main_bot_id, workspace_kind, workspace_label, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'unopened', '', 'active', ?, ?)`,
      )
      .run(id, workspaceId, cleanName, text(summary, 4000), goal, mainBotId, now, now);
    this.audit(workspaceId, "project.created", `Created project “${cleanName}”. A project is not a provider computer.`);
    return this.project(id);
  }

  createMainBot(workspaceId: string, displayName: string, providerKind = "simulated") {
    this.workspace(workspaceId);
    if (!["simulated", "claude-duet", "openai-dot"].includes(providerKind)) {
      throw new DomainError(400, "bad_provider", "A main bot can be Simulated, Claude Duet, or OpenAI dot.");
    }
    const id = idFor("mb");
    const now = this.nowIso();
    const note =
      providerKind === "simulated"
        ? "Simulated main bot. It is not a Claude Duet or an OpenAI dot, and it has not been shown to wake one."
        : "Not connected. Saving this choice does not create a Duet or a dot. Live calls are not tested.";
    this.deps.db
      .prepare(
        `INSERT INTO main_bots (id, workspace_id, display_name, provider_kind, note, secret_id, last_mcp_call_at, created_at)
         VALUES (?, ?, ?, ?, ?, NULL, NULL, ?)`,
      )
      .run(id, workspaceId, requiredText(displayName, "Main bot name", 120), providerKind, note, now);
    this.audit(workspaceId, "main_bot.created", `Added main bot “${displayName}” as ${providerKind}.`);
    return this.mainBot(id);
  }

  mainBot(id: string) {
    const row = this.one("SELECT * FROM main_bots WHERE id = ?", id);
    if (!row) throw new DomainError(404, "not_found", "That main bot is not on this computer.");
    return presentMainBot(row);
  }

  mainBots(workspaceId: string) {
    return this.deps.db.prepare("SELECT * FROM main_bots WHERE workspace_id = ? ORDER BY created_at ASC").all(workspaceId).map(presentMainBot);
  }

  prepareMainCredential(id: string) {
    const bot = this.mainBot(id);
    const token = `rlb_${crypto.randomBytes(16).toString("hex")}`;
    const secretId = idFor("sec");
    const now = this.nowIso();
    const previousRow = this.one("SELECT secret_id FROM main_bots WHERE id = ?", id);
    const previous = previousRow?.secret_id ? String(previousRow.secret_id) : null;
    this.deps.secrets.put(secretId, "main_bot_bearer", token, now);
    this.deps.db.prepare("UPDATE main_bots SET secret_id = ? WHERE id = ?").run(secretId, id);
    if (previous) this.deps.secrets.delete(previous);
    this.audit(bot.workspaceId, "main_bot.credential", `Stored a connector credential for ${bot.displayName}. The token is not in this log.`);
    return { mainBot: this.mainBot(id), bearerToken: token };
  }

  delegate(mainBotId: string, projectId: string, title: string, body: string) {
    const bot = this.mainBot(mainBotId);
    const project = this.project(projectId);
    if (project.workspaceId !== bot.workspaceId) throw new DomainError(403, "cross_workspace", "That project is in another company.");
    if (project.mainBotId && project.mainBotId !== bot.id) {
      throw new DomainError(403, "wrong_main_bot", "That project belongs to another main bot.");
    }
    const task = this.createTask(projectId, { title, body });
    const now = this.nowIso();
    transaction(this.deps.db, () => {
      this.deps.db.prepare("UPDATE tasks SET state = 'queued', updated_at = ? WHERE id = ?").run(now, task.id);
      this.event(
        task.id,
        project.workspaceId,
        "main_bot",
        bot.id,
        "draft",
        "queued",
        `Delegated by ${bot.displayName} inside Roster Lab. No Duet or dot was messaged.`,
      );
    });
    this.audit(project.workspaceId, "task.delegated", `${bot.displayName} delegated “${task.title}” to ${project.name}.`);
    return this.task(task.id);
  }

  async runDelegated(projectId: string, taskId: string) {
    const project = this.project(projectId);
    const task = this.task(taskId);
    if (task.projectId !== project.id) throw new DomainError(403, "wrong_project", "That task is not in this project.");
    if (task.state === "completed") return { task, project, alreadyDone: true };
    const workDir = path.join(this.deps.dataDir, "project-files", project.id);
    const profileDir = path.join(this.deps.dataDir, "browser-profiles", project.id);
    const framePath = path.join(this.deps.dataDir, "frames", `${project.id}.png`);
    fs.mkdirSync(workDir, { recursive: true });
    const note = [
      `Project: ${project.name}`,
      `Task: ${task.title}`,
      "Written by the Roster Lab project runner on this computer.",
      `${LOCAL_BROWSER_LABEL}.`,
      "Not a Claude Duet or OpenAI dot computer.",
    ].join("\n");
    fs.writeFileSync(path.join(workDir, "note.txt"), note);
    const now = this.nowIso();
    this.deps.db.prepare("UPDATE tasks SET state = 'in_progress', updated_at = ? WHERE id = ?").run(now, task.id);
    this.event(task.id, project.workspaceId, "workspace", project.id, task.state, "in_progress", "Opening a local browser profile. This is not an isolated VM.");
    try {
      await captureInProfile({ profileDir, screenshotPath: framePath, html: workPage(project.name, task.title, note) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The browser did not start.";
      this.event(task.id, project.workspaceId, "workspace", project.id, "in_progress", "failed", message);
      this.deps.db.prepare("UPDATE tasks SET state = 'failed', updated_at = ? WHERE id = ?").run(this.nowIso(), task.id);
      throw new DomainError(500, "workspace_failed", message);
    }
    const endpoint = `/api/projects/${project.id}/workspace/frame`;
    const result = `Completed in a ${LOCAL_BROWSER_LABEL}. The note is in this project's files. The capture is on the project page. No provider computer was used.`;
    const finished = this.nowIso();
    transaction(this.deps.db, () => {
      this.deps.db
        .prepare(
          `UPDATE tasks SET state = 'completed', result_body = ?, result_label = 'local_browser', result_key = ?, updated_at = ? WHERE id = ?`,
        )
        .run(result, `local-${task.id}`, finished, task.id);
      this.deps.db
        .prepare(
          `UPDATE projects SET workspace_kind = 'local_browser', workspace_label = ?, workspace_endpoint = ?, frame_path = ?, updated_at = ? WHERE id = ?`,
        )
        .run(LOCAL_BROWSER_LABEL, endpoint, framePath, finished, project.id);
      this.event(task.id, project.workspaceId, "workspace", project.id, "in_progress", "completed", result);
    });
    this.audit(project.workspaceId, "workspace.opened", `${project.name}: ${LOCAL_BROWSER_LABEL}. Endpoint ${endpoint}.`);
    return { task: this.task(task.id), project: this.project(project.id), alreadyDone: false };
  }

  framePath(projectId: string): string | null {
    const row = this.one("SELECT frame_path FROM projects WHERE id = ?", projectId);
    if (!row?.frame_path) return null;
    const file = String(row.frame_path);
    const root = path.resolve(this.deps.dataDir, "frames");
    const resolved = path.resolve(file);
    if (!resolved.startsWith(root + path.sep) && resolved !== root) return null;
    if (!fs.existsSync(resolved)) return null;
    return resolved;
  }

  async createMainBotDemo() {
    const workspace = this.createWorkspace("Main bot demo");
    const bot = this.createMainBot(workspace.id, "Main bot (Simulated)", "simulated");
    const project = this.createProject(workspace.id, "Software Engineer", "Sub-bot that works in its own browser profile.", {
      goal: "Write a note in this project's browser profile and leave a capture.",
      mainBotId: bot.id,
    });
    const task = this.delegate(
      bot.id,
      project.id,
      "Write the workspace note",
      "Write note.txt and show it in the Software Engineer browser profile.",
    );
    await this.runDelegated(project.id, task.id);
    return this.snapshot(workspace.id);
  }

  updateProject(id: string, input: { name?: string; summary?: string; status?: string }) {
    const project = this.project(id);
    const name = input.name === undefined ? project.name : requiredText(input.name, "Project name", 120);
    const summary = input.summary === undefined ? project.summary : text(input.summary, 4000);
    const status = input.status === undefined ? project.status : input.status;
    if (status !== "active" && status !== "archived") throw new DomainError(400, "bad_status", "A project is active or archived.");
    const now = this.nowIso();
    this.deps.db.prepare("UPDATE projects SET name = ?, summary = ?, status = ?, updated_at = ? WHERE id = ?").run(name, summary, status, now, id);
    return this.project(id);
  }

  project(id: string) {
    const row = this.one("SELECT * FROM projects WHERE id = ?", id);
    if (!row) throw new DomainError(404, "not_found", "That project is not on this computer.");
    return presentProject(row);
  }

  projects(workspaceId: string) {
    return this.deps.db.prepare("SELECT * FROM projects WHERE workspace_id = ? ORDER BY created_at ASC").all(workspaceId).map(presentProject);
  }

  createEmployee(workspaceId: string, input: { displayName: string; roleTitle: string; responsibilities?: string; instructions?: string }) {
    this.workspace(workspaceId);
    const id = idFor("em");
    const now = this.nowIso();
    const displayName = requiredText(input.displayName, "Name", 120);
    const roleTitle = requiredText(input.roleTitle, "Role", 120);
    transaction(this.deps.db, () => {
      this.deps.db
        .prepare(
          `INSERT INTO employees (id, workspace_id, display_name, role_title, responsibilities, instructions, provider_kind, allowed_projects, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'none', '[]', ?, ?)`,
        )
        .run(id, workspaceId, displayName, roleTitle, text(input.responsibilities ?? "", 8000), text(input.instructions ?? "", 8000), now, now);
      this.deps.db
        .prepare(
          `INSERT INTO computers (id, employee_id, kind, label, isolation, evidence_json, last_confirmed_at, updated_at)
           VALUES (?, ?, 'none', ?, 'not_connected', NULL, NULL, ?)`,
        )
        .run(idFor("cp"), id, "No computer is attached. A role is not a computer.", now);
    });
    this.audit(workspaceId, "employee.created", `Added ${displayName}. No provider and no computer were created.`);
    return this.employee(id);
  }

  updateEmployee(
    id: string,
    input: { displayName?: string; roleTitle?: string; responsibilities?: string; instructions?: string; allowedProjectIds?: string[] },
  ) {
    const employee = this.employee(id);
    const displayName = input.displayName === undefined ? employee.displayName : requiredText(input.displayName, "Name", 120);
    const roleTitle = input.roleTitle === undefined ? employee.roleTitle : requiredText(input.roleTitle, "Role", 120);
    const responsibilities = input.responsibilities === undefined ? employee.responsibilities : text(input.responsibilities, 8000);
    const instructions = input.instructions === undefined ? employee.instructions : text(input.instructions, 8000);
    let allowed = JSON.stringify(employee.allowedProjectIds);
    if (input.allowedProjectIds) {
      const ids = [...new Set(input.allowedProjectIds)];
      for (const projectId of ids) {
        const project = this.project(projectId);
        if (project.workspaceId !== employee.workspaceId) {
          throw new DomainError(403, "cross_workspace", "A person can only be allowed into projects in their own company.");
        }
      }
      allowed = JSON.stringify(ids);
    }
    this.deps.db
      .prepare(
        `UPDATE employees SET display_name = ?, role_title = ?, responsibilities = ?, instructions = ?, allowed_projects = ?, updated_at = ? WHERE id = ?`,
      )
      .run(displayName, roleTitle, responsibilities, instructions, allowed, this.nowIso(), id);
    return this.employee(id);
  }

  setProvider(id: string, kind: string) {
    if (!PROVIDERS.has(kind)) throw new DomainError(400, "bad_provider", "Choose no provider, Simulated, Claude Duet, or OpenAI dot.");
    const employee = this.employee(id);
    const now = this.nowIso();
    const secretId = this.connectionSecret(id);
    transaction(this.deps.db, () => {
      this.deps.db.prepare("UPDATE employees SET provider_kind = ?, updated_at = ? WHERE id = ?").run(kind, now, id);
      this.deps.db.prepare("DELETE FROM connections WHERE employee_id = ?").run(id);
      if (kind === "simulated") {
        this.deps.db
          .prepare(
            `INSERT INTO connections (id, employee_id, provider, status, secret_id, last_mcp_call_at, revoked_at, note, updated_at)
             VALUES (?, ?, 'simulated', 'simulated', NULL, NULL, NULL, ?, ?)`,
          )
          .run(idFor("cn"), id, "Simulated. This is a local test worker, not a live agent.", now);
        this.deps.db
          .prepare(
            `UPDATE computers SET kind = 'simulated_harness', label = ?, isolation = 'simulated', evidence_json = NULL, last_confirmed_at = ?, updated_at = ? WHERE employee_id = ?`,
          )
          .run("Simulated harness on this Roster Lab process. Not a Duet or dot computer.", now, now, id);
      } else if (kind === "none") {
        this.deps.db
          .prepare(
            `UPDATE computers SET kind = 'none', label = ?, isolation = 'not_connected', evidence_json = NULL, last_confirmed_at = NULL, updated_at = ? WHERE employee_id = ?`,
          )
          .run("No computer is attached. A role is not a computer.", now, id);
      } else {
        this.deps.db
          .prepare(
            `INSERT INTO connections (id, employee_id, provider, status, secret_id, last_mcp_call_at, revoked_at, note, updated_at)
             VALUES (?, ?, ?, 'not_connected', NULL, NULL, NULL, ?, ?)`,
          )
          .run(
            idFor("cn"),
            id,
            kind,
            "Not connected. Choosing Claude Duet or an OpenAI dot here does not create that product or a computer.",
            now,
          );
        this.deps.db
          .prepare(
            `UPDATE computers SET kind = 'provider_unverified', label = ?, isolation = 'not_connected', evidence_json = NULL, last_confirmed_at = NULL, updated_at = ? WHERE employee_id = ?`,
          )
          .run("No provider computer has been demonstrated.", now, id);
      }
    });
    if (secretId) this.deps.secrets.delete(secretId);
    this.audit(employee.workspaceId, "employee.provider_set", `Set ${employee.displayName} to ${kind}. No agent was created.`);
    return this.employee(id);
  }

  prepareCredential(id: string) {
    const employee = this.employee(id);
    if (employee.providerKind !== "claude-duet" && employee.providerKind !== "openai-dot") {
      throw new DomainError(400, "not_a_provider_profile", "A connector credential is only for a Claude Duet or OpenAI dot profile.");
    }
    const token = `rlb_${crypto.randomBytes(16).toString("hex")}`;
    const secretId = idFor("sec");
    const now = this.nowIso();
    const previous = this.connectionSecret(id);
    this.deps.secrets.put(secretId, "connector_bearer", token, now);
    this.deps.db
      .prepare(
        `UPDATE connections SET secret_id = ?, status = 'not_connected', revoked_at = NULL, note = ?, updated_at = ? WHERE employee_id = ?`,
      )
      .run(secretId, "Credential stored on this computer. No provider has been identified.", now, id);
    if (previous) this.deps.secrets.delete(previous);
    this.audit(employee.workspaceId, "credential.prepared", `Stored a connector credential for ${employee.displayName}. The token is not in this log.`);
    return { employee: this.employee(id), bearerToken: token };
  }

  revokeCredential(id: string) {
    const employee = this.employee(id);
    const secretId = this.connectionSecret(id);
    const now = this.nowIso();
    this.deps.db
      .prepare(
        `UPDATE connections SET secret_id = NULL, status = 'unavailable', revoked_at = ?, note = ?, updated_at = ? WHERE employee_id = ?`,
      )
      .run(now, "Roster Lab credential revoked. Also disconnect the connector in the provider if you added one.", now, id);
    this.deps.db.prepare("DELETE FROM subscriptions WHERE employee_id = ?").run(id);
    if (secretId) this.deps.secrets.delete(secretId);
    this.audit(employee.workspaceId, "credential.revoked", `Revoked the local credential for ${employee.displayName}.`);
    return this.employee(id);
  }

  recordEvidence(id: string, raw: unknown) {
    const employee = this.employee(id);
    if (employee.providerKind === "simulated" || employee.providerKind === "none") {
      throw new DomainError(400, "not_a_real_provider", "Simulation and empty profiles cannot be marked as an independent computer.");
    }
    const evidence = parseEvidence(raw);
    if (!evidence) throw new DomainError(400, "bad_evidence", "Evidence needs the four checks, how the marker was tried, a scope, a source note, and an operator record.");
    const decision = evaluateEvidence(employee.providerKind, evidence);
    const now = this.nowIso();
    this.deps.db
      .prepare(`UPDATE computers SET isolation = ?, evidence_json = ?, last_confirmed_at = ?, updated_at = ?, label = ? WHERE employee_id = ?`)
      .run(decision.isolation, JSON.stringify(evidence), now, now, computerLabel(decision.isolation), id);
    this.audit(
      employee.workspaceId,
      "computer.evidence_recorded",
      `Recorded operator evidence for ${employee.displayName}. Isolation is ${decision.isolation}. Roster Lab did not run the check.`,
    );
    return this.employee(id);
  }

  createTask(projectId: string, input: { title: string; body?: string }) {
    const project = this.project(projectId);
    const id = idFor("tk");
    const now = this.nowIso();
    const title = requiredText(input.title, "Task title", 200);
    this.deps.db
      .prepare(
        `INSERT INTO tasks (id, workspace_id, project_id, title, body, assignee_id, state, claim_owner_id, claim_expires_at, result_body, result_label, result_key, unknown_reason, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NULL, 'draft', NULL, NULL, NULL, NULL, NULL, NULL, ?, ?)`,
      )
      .run(id, project.workspaceId, projectId, title, text(input.body ?? "", 20000), now, now);
    this.event(id, project.workspaceId, "user", null, null, "draft", "Draft saved by the person using Roster Lab.");
    return this.task(id);
  }

  updateTask(id: string, input: { title?: string; body?: string }) {
    const task = this.task(id);
    if (task.state !== "draft" && task.state !== "queued") {
      throw new DomainError(400, "locked", "Edit the title and brief while the task is a draft or queued.");
    }
    const title = input.title === undefined ? task.title : requiredText(input.title, "Task title", 200);
    const body = input.body === undefined ? task.body : text(input.body, 20000);
    this.deps.db.prepare("UPDATE tasks SET title = ?, body = ?, updated_at = ? WHERE id = ?").run(title, body, this.nowIso(), id);
    return this.task(id);
  }

  assignTask(id: string, employeeId: string) {
    const task = this.task(id);
    const employee = this.employee(employeeId);
    this.assertCanTake(employee, task.projectId, task.workspaceId);
    if (task.state === "completed" || task.state === "failed") {
      throw new DomainError(400, "closed", "Reopen is not automatic. Create a new task or reconcile an unknown one.");
    }
    const now = this.nowIso();
    const next: TaskState = task.state === "claimed" || task.state === "in_progress" ? "queued" : (task.state as TaskState);
    transaction(this.deps.db, () => {
      this.deps.db
        .prepare("UPDATE tasks SET assignee_id = ?, state = ?, claim_owner_id = NULL, claim_expires_at = NULL, updated_at = ? WHERE id = ?")
        .run(employeeId, next, now, id);
      this.event(id, task.workspaceId, "user", null, task.state, next, `Assigned to ${employee.displayName} inside Roster Lab. This did not message a provider.`);
    });
    return this.task(id);
  }

  queueTask(id: string) {
    const task = this.task(id);
    if (!task.assigneeId) throw new DomainError(400, "unassigned", "Assign someone before queueing.");
    if (task.state !== "draft") throw new DomainError(400, "bad_transition", "Only a draft can be queued.");
    const now = this.nowIso();
    transaction(this.deps.db, () => {
      this.deps.db.prepare("UPDATE tasks SET state = 'queued', updated_at = ? WHERE id = ?").run(now, id);
      this.event(id, task.workspaceId, "user", null, "draft", "queued", "Queued in Roster Lab. No provider was notified by this action alone.");
    });
    return this.task(id);
  }

  handoff(id: string, toEmployeeId: string, note: string) {
    const task = this.task(id);
    const nextEmployee = this.employee(toEmployeeId);
    this.assertCanTake(nextEmployee, task.projectId, task.workspaceId);
    if (["completed", "failed", "unknown"].includes(task.state)) {
      throw new DomainError(400, "closed", "This task is not open for a handoff.");
    }
    const cleanNote = requiredText(note, "Handoff note", 2000);
    const now = this.nowIso();
    const nextState: TaskState = task.state === "draft" ? "draft" : "queued";
    transaction(this.deps.db, () => {
      this.deps.db
        .prepare("UPDATE tasks SET assignee_id = ?, state = ?, claim_owner_id = NULL, claim_expires_at = NULL, updated_at = ? WHERE id = ?")
        .run(toEmployeeId, nextState, now, id);
      this.event(
        id,
        task.workspaceId,
        "user",
        null,
        task.state,
        nextState,
        `Handed off inside Roster Lab to ${nextEmployee.displayName}. ${cleanNote} No provider agent was messaged.`,
      );
    });
    return this.task(id);
  }

  cancelLocal(id: string) {
    const task = this.task(id);
    if (task.state === "completed") throw new DomainError(400, "closed", "A completed task stays completed. It was not canceled.");
    const employee = task.assigneeId ? this.employee(task.assigneeId) : null;
    const remote = remoteCancel(employee?.providerKind ?? "none");
    const now = this.nowIso();
    const note =
      employee?.providerKind === "simulated"
        ? "Marked failed in Roster Lab. The simulated step will not write another result."
        : remote.ok
          ? "Marked failed in Roster Lab."
          : `Marked failed in Roster Lab. ${remote.reason}`;
    transaction(this.deps.db, () => {
      this.deps.db
        .prepare("UPDATE tasks SET state = 'failed', claim_owner_id = NULL, claim_expires_at = NULL, updated_at = ?, unknown_reason = NULL WHERE id = ?")
        .run(now, id);
      this.event(id, task.workspaceId, "user", null, task.state, "failed", note);
    });
    return { task: this.task(id), remote };
  }

  reconcile(id: string, choice: string, note: string) {
    const task = this.task(id);
    if (task.state !== "unknown") throw new DomainError(400, "not_unknown", "Only an unknown task can be reconciled.");
    const clean = requiredText(note, "Reconciliation note", 2000);
    const now = this.nowIso();
    if (choice === "requeue") {
      transaction(this.deps.db, () => {
        this.deps.db
          .prepare(
            `UPDATE tasks SET state = 'queued', claim_owner_id = NULL, claim_expires_at = NULL, result_body = NULL, result_label = NULL, result_key = NULL, unknown_reason = NULL, updated_at = ? WHERE id = ?`,
          )
          .run(now, id);
        this.event(id, task.workspaceId, "user", null, "unknown", "queued", `Requeued after unknown. ${clean}`);
      });
    } else if (choice === "mark_failed") {
      transaction(this.deps.db, () => {
        this.deps.db.prepare("UPDATE tasks SET state = 'failed', unknown_reason = NULL, updated_at = ? WHERE id = ?").run(now, id);
        this.event(id, task.workspaceId, "user", null, "unknown", "failed", `Marked failed after unknown. ${clean}`);
      });
    } else if (choice === "accept_completed") {
      transaction(this.deps.db, () => {
        this.deps.db
          .prepare("UPDATE tasks SET state = 'completed', result_label = 'user', unknown_reason = NULL, updated_at = ? WHERE id = ?")
          .run(now, id);
        this.event(
          id,
          task.workspaceId,
          "user",
          null,
          "unknown",
          "completed",
          `Accepted by the person using Roster Lab. ${clean} This is not a provider confirmation.`,
        );
      });
    } else {
      throw new DomainError(400, "bad_choice", "Reconcile by requeue, mark_failed, or accept_completed.");
    }
    return this.task(id);
  }

  addAttachment(taskId: string, filename: string, base64: string) {
    const task = this.task(taskId);
    const name = filename.replace(/[/\\]/g, "").trim();
    if (!name || name.length > 120) throw new DomainError(400, "bad_file", "Use a file name of 1 to 120 characters, without a folder.");
    const bytes = Buffer.from(base64, "base64");
    if (bytes.length === 0 || bytes.length > MAX_ATTACHMENT) {
      throw new DomainError(400, "bad_file", "Attachments must be between 1 byte and 200000 bytes.");
    }
    const id = idFor("at");
    this.deps.db
      .prepare(
        `INSERT INTO attachments (id, task_id, workspace_id, filename, byte_size, content_base64, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, taskId, task.workspaceId, name, bytes.length, base64, this.nowIso());
    return { id, filename: name, byteSize: bytes.length, createdAt: this.nowIso() };
  }

  attachment(id: string) {
    const row = this.one("SELECT id, task_id, workspace_id, filename, byte_size, content_base64, created_at FROM attachments WHERE id = ?", id);
    if (!row) throw new DomainError(404, "not_found", "That file is not on this computer.");
    return {
      id: String(row.id),
      taskId: String(row.task_id),
      workspaceId: String(row.workspace_id),
      filename: String(row.filename),
      byteSize: Number(row.byte_size),
      contentBase64: String(row.content_base64),
      createdAt: String(row.created_at),
    };
  }

  runSimulated(taskId: string) {
    const existing = this.task(taskId);
    if (!existing.assigneeId) throw new DomainError(400, "unassigned", "Assign a simulated person first.");
    const employee = this.employee(existing.assigneeId);
    if (employee.providerKind !== "simulated") {
      throw new DomainError(400, "not_simulated", "Simulated results are not written onto a Claude Duet or OpenAI dot task.");
    }
    if (existing.state === "completed" && existing.resultLabel === "simulated") {
      this.event(taskId, existing.workspaceId, "simulated", employee.id, "completed", "completed", "Duplicate simulated completion ignored. The first simulated result still stands.");
      return { task: this.task(taskId), duplicate: true };
    }
    if (existing.state === "failed" || existing.state === "unknown" || existing.state === "needs_input") {
      throw new DomainError(400, "bad_transition", "This task is not open for a simulated run.");
    }
    const result = `SIMULATED — local test only. No Claude Duet, OpenAI dot, live browser, or separate computer was used. Task: ${existing.title}.`;
    const now = this.nowIso();
    const expiry = new Date(this.deps.now().getTime() + CLAIM_MS).toISOString();
    transaction(this.deps.db, () => {
      this.deps.db
        .prepare(
          `UPDATE tasks SET state = 'in_progress', claim_owner_id = ?, claim_expires_at = ?, updated_at = ? WHERE id = ?`,
        )
        .run(employee.id, expiry, now, taskId);
      this.event(taskId, existing.workspaceId, "simulated", employee.id, existing.state, "in_progress", "Simulated worker claimed the task inside this process.");
      this.deps.db
        .prepare(
          `UPDATE tasks SET state = 'completed', result_body = ?, result_label = 'simulated', result_key = ?, claim_owner_id = NULL, claim_expires_at = NULL, updated_at = ? WHERE id = ?`,
        )
        .run(result, `sim-${taskId}`, now, taskId);
      this.event(taskId, existing.workspaceId, "simulated", employee.id, "in_progress", "completed", result);
      this.deps.db.prepare("UPDATE computers SET last_confirmed_at = ?, updated_at = ? WHERE employee_id = ?").run(now, now, employee.id);
    });
    return { task: this.task(taskId), duplicate: false };
  }

  requestMediated(workspaceId: string, taskId: string | null, kind: string, summary: string) {
    if (!KINDS.has(kind)) throw new DomainError(400, "bad_kind", "Ask about a message, a purchase, publishing, or deleting data.");
    const ws = this.workspace(workspaceId);
    if (taskId) {
      const task = this.task(taskId);
      if (task.workspaceId !== workspaceId) throw new DomainError(403, "cross_workspace", "That task is in another company.");
    }
    const needed =
      (kind === "send_message" && ws.approvals.send) ||
      (kind === "purchase" && ws.approvals.purchase) ||
      (kind === "publish" && ws.approvals.publish) ||
      (kind === "delete_data" && ws.approvals.deleteData);
    const clean = requiredText(summary, "Summary", 2000);
    if (!needed) {
      this.audit(workspaceId, "mediated.skipped", `Approval for ${kind} is off. Roster Lab still did not perform the external action. ${clean}`);
      return { approval: null, performed: false, reason: "The approval switch is off. Roster Lab does not send, spend, or publish either way." };
    }
    const approval = this.requestApproval(workspaceId, taskId, kind, clean);
    return { approval, performed: false, reason: "Waiting for a decision. Nothing was sent, spent, published, or deleted." };
  }

  decideApproval(id: string, decision: string) {
    const approval = this.mustApproval(id);
    this.expireApprovals(approval.workspaceId);
    const fresh = this.mustApproval(id);
    if (fresh.status !== "pending") throw new DomainError(400, "not_pending", "That request is no longer waiting.");
    const now = this.nowIso();
    if (decision === "deny") {
      const outcome = "Denied. Nothing was sent, spent, published, or deleted.";
      this.deps.db.prepare("UPDATE approvals SET status = 'denied', decided_at = ?, outcome = ? WHERE id = ?").run(now, outcome, id);
    } else if (decision === "approve") {
      const outcome = approvalOutcome(fresh.kind);
      this.deps.db.prepare("UPDATE approvals SET status = 'approved', decided_at = ?, outcome = ? WHERE id = ?").run(now, outcome, id);
    } else {
      throw new DomainError(400, "bad_decision", "Choose approve or deny.");
    }
    this.audit(fresh.workspaceId, "approval.decided", `${decision} for ${fresh.kind}.`);
    return this.mustApproval(id);
  }

  task(id: string) {
    const row = this.one("SELECT * FROM tasks WHERE id = ?", id);
    if (!row) throw new DomainError(404, "not_found", "That task is not on this computer.");
    return presentTask(row, this.eventsFor(id), this.attachmentsFor(id));
  }

  tasks(workspaceId: string) {
    return this.deps.db
      .prepare("SELECT * FROM tasks WHERE workspace_id = ? ORDER BY created_at ASC")
      .all(workspaceId)
      .map((row) => presentTask(row, this.eventsFor(String(row.id)), this.attachmentsFor(String(row.id))));
  }

  employee(id: string) {
    const row = this.one("SELECT * FROM employees WHERE id = ?", id);
    if (!row) throw new DomainError(404, "not_found", "That person is not on this computer.");
    const connection = this.one("SELECT * FROM connections WHERE employee_id = ?", id);
    const computer = this.one("SELECT * FROM computers WHERE employee_id = ?", id);
    return presentEmployee(row, connection, computer);
  }

  employees(workspaceId: string) {
    return this.deps.db
      .prepare("SELECT * FROM employees WHERE workspace_id = ? ORDER BY created_at ASC")
      .all(workspaceId)
      .map((row) => this.employee(String(row.id)));
  }

  actorByToken(token: string): { kind: "employee"; employeeId: string } | { kind: "main"; mainBotId: string } | null {
    const employee = this.employeeByToken(token);
    if (employee) return { kind: "employee", employeeId: employee.employee.id };
    if (!token.startsWith("rlb_")) return null;
    const bots = this.deps.db.prepare("SELECT id, secret_id FROM main_bots WHERE secret_id IS NOT NULL").all();
    for (const bot of bots) {
      const secretId = bot.secret_id ? String(bot.secret_id) : "";
      if (secretId && this.deps.secrets.get(secretId) === token) return { kind: "main", mainBotId: String(bot.id) };
    }
    return null;
  }

  noteMainCall(mainBotId: string) {
    this.deps.db.prepare("UPDATE main_bots SET last_mcp_call_at = ? WHERE id = ?").run(this.nowIso(), mainBotId);
  }

  employeeByToken(token: string) {
    if (!token.startsWith("rlb_")) return null;
    const connections = this.deps.db.prepare("SELECT * FROM connections WHERE secret_id IS NOT NULL AND revoked_at IS NULL").all();
    for (const connection of connections) {
      const secretId = connection.secret_id ? String(connection.secret_id) : "";
      if (secretId && this.deps.secrets.get(secretId) === token) {
        return { employee: this.employee(String(connection.employee_id)), connection };
      }
    }
    return null;
  }

  readSecret(secretId: string): string | null {
    return this.deps.secrets.get(secretId);
  }

  noteDelivery(taskId: string, note: string) {
    const task = this.task(taskId);
    this.event(taskId, task.workspaceId, "system", null, task.state, task.state, note);
  }

  noteMcpCall(employeeId: string) {
    const now = this.nowIso();
    this.deps.db.prepare("UPDATE connections SET last_mcp_call_at = ?, updated_at = ? WHERE employee_id = ?").run(now, now, employeeId);
  }

  claimForEmployee(employeeId: string, taskId: string) {
    const employee = this.employee(employeeId);
    const task = this.task(taskId);
    this.assertCanTake(employee, task.projectId, task.workspaceId);
    if (task.assigneeId !== employeeId) throw new DomainError(403, "not_assignee", "This credential can only claim tasks assigned to its own profile.");
    const now = this.deps.now();
    const expired = task.claimExpiresAt ? new Date(task.claimExpiresAt).getTime() <= now.getTime() : false;
    const open = task.state === "queued" || ((task.state === "claimed" || task.state === "in_progress") && expired);
    if (task.state === "claimed" && task.claimOwnerId === employeeId && !expired) return this.task(taskId);
    if (!open) throw new DomainError(409, "not_claimable", "This task is not waiting to be claimed.");
    const expiry = new Date(now.getTime() + CLAIM_MS).toISOString();
    transaction(this.deps.db, () => {
      this.deps.db
        .prepare("UPDATE tasks SET state = 'claimed', claim_owner_id = ?, claim_expires_at = ?, updated_at = ? WHERE id = ?")
        .run(employeeId, expiry, now.toISOString(), taskId);
      this.event(taskId, task.workspaceId, "mcp_client", employeeId, task.state, "claimed", "Claimed by the MCP client that holds this profile's credential. The client was not identified as Duet or a dot.");
    });
    return this.task(taskId);
  }

  reportProgress(employeeId: string, taskId: string, note: string) {
    const task = this.ownedOpenTask(employeeId, taskId);
    const clean = redact(requiredText(note, "Note", 4000));
    const now = this.nowIso();
    transaction(this.deps.db, () => {
      if (task.state === "claimed") {
        this.deps.db.prepare("UPDATE tasks SET state = 'in_progress', updated_at = ? WHERE id = ?").run(now, taskId);
      } else {
        this.deps.db.prepare("UPDATE tasks SET updated_at = ? WHERE id = ?").run(now, taskId);
      }
      this.event(taskId, task.workspaceId, "mcp_client", employeeId, task.state, task.state === "claimed" ? "in_progress" : task.state, clean);
    });
    return this.task(taskId);
  }

  reportResult(employeeId: string, taskId: string, idempotencyKey: string, body: string) {
    const key = requiredText(idempotencyKey, "Idempotency key", 200);
    const clean = redact(text(body, 20000));
    const task = this.task(taskId);
    const employee = this.employee(employeeId);
    this.assertCanTake(employee, task.projectId, task.workspaceId);
    if (task.assigneeId !== employeeId) throw new DomainError(403, "not_assignee", "This credential cannot complete someone else's task.");
    if (task.state === "completed" && task.resultKey === key) {
      this.event(taskId, task.workspaceId, "mcp_client", employeeId, "completed", "completed", "Duplicate result ignored. The first result still stands.");
      return { task: this.task(taskId), duplicate: true, unknown: false };
    }
    if (task.state === "completed" && task.resultKey !== key) {
      this.markUnknown(task, "A second result used a different idempotency key. The first result was kept. Reconcile before trusting either one.");
      return { task: this.task(taskId), duplicate: false, unknown: true };
    }
    if (task.state === "unknown") throw new DomainError(409, "unknown", "This task is unknown. Reconcile it before sending another result.");
    const now = this.deps.now();
    const expired = task.claimExpiresAt ? new Date(task.claimExpiresAt).getTime() <= now.getTime() : true;
    const claimedByCaller = task.claimOwnerId === employeeId && (task.state === "claimed" || task.state === "in_progress");
    if (!claimedByCaller || expired) {
      this.markUnknown(task, "A result arrived without a current claim. It was not saved as completion. Reconcile, then claim again if you still want the work done.");
      return { task: this.task(taskId), duplicate: false, unknown: true };
    }
    const stored = `Reported by a local MCP client. Not a live Claude Duet or OpenAI dot response.\n\n${clean}`;
    transaction(this.deps.db, () => {
      this.deps.db
        .prepare(
          `UPDATE tasks SET state = 'completed', result_body = ?, result_label = 'mcp_client', result_key = ?, claim_owner_id = NULL, claim_expires_at = NULL, updated_at = ? WHERE id = ?`,
        )
        .run(stored, key, now.toISOString(), taskId);
      this.event(taskId, task.workspaceId, "mcp_client", employeeId, task.state, "completed", "Result stored from the MCP client bound to this credential. The caller was not verified as Duet or a dot.");
    });
    return { task: this.task(taskId), duplicate: false, unknown: false };
  }

  requestInput(employeeId: string, taskId: string, summary: string) {
    const task = this.ownedOpenTask(employeeId, taskId);
    const clean = redact(requiredText(summary, "Summary", 2000));
    const now = this.nowIso();
    transaction(this.deps.db, () => {
      this.deps.db
        .prepare("UPDATE tasks SET state = 'needs_input', claim_owner_id = NULL, claim_expires_at = NULL, updated_at = ? WHERE id = ?")
        .run(now, taskId);
      this.event(taskId, task.workspaceId, "mcp_client", employeeId, task.state, "needs_input", clean);
    });
    return this.task(taskId);
  }

  assignedTasks(employeeId: string) {
    const employee = this.employee(employeeId);
    return this.tasks(employee.workspaceId).filter((task) => task.assigneeId === employeeId && employee.allowedProjectIds.includes(task.projectId));
  }

  activity(workspaceId: string) {
    this.workspace(workspaceId);
    const events = this.deps.db
      .prepare("SELECT * FROM task_events WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 40")
      .all(workspaceId)
      .map(presentEvent);
    const audit = this.deps.db
      .prepare("SELECT * FROM audit WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 40")
      .all(workspaceId)
      .map(presentAudit);
    return [...events.map((event) => ({ ...event, kind: "task" as const })), ...audit.map((entry) => ({ ...entry, kind: "audit" as const }))].sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : -1,
    );
  }

  approvals(workspaceId: string) {
    this.expireApprovals(workspaceId);
    return this.deps.db.prepare("SELECT * FROM approvals WHERE workspace_id = ? ORDER BY requested_at DESC").all(workspaceId).map(presentApproval);
  }

  exportWorkspace(id: string) {
    const snapshot = this.snapshot(id);
    return {
      exportedAt: this.nowIso(),
      notice: "This export has no connector tokens and no webhook secrets.",
      workspace: snapshot.workspace,
      projects: snapshot.projects,
      mainBots: snapshot.mainBots.map((bot) => ({ ...bot, credentialPrepared: bot.credentialPrepared })),
      employees: snapshot.employees.map((employee) => ({
        ...employee,
        connection: employee.connection ? { ...employee.connection, secretId: undefined } : null,
      })),
      tasks: snapshot.tasks.map((task) => ({
        ...task,
        attachments: task.attachments.map(({ id, filename, byteSize, createdAt }) => ({ id, filename, byteSize, createdAt })),
      })),
      approvals: snapshot.approvals,
      activity: snapshot.activity,
    };
  }

  snapshot(id: string) {
    const workspace = this.workspace(id);
    const tasks = this.tasks(id);
    const approvals = this.approvals(id);
    return {
      workspace,
      projects: this.projects(id),
      mainBots: this.mainBots(id),
      employees: this.employees(id),
      tasks,
      approvals,
      activity: this.activity(id).slice(0, 30),
      attention: {
        approvals: approvals.filter((item) => item.status === "pending"),
        unknownTasks: tasks.filter((task) => task.state === "unknown"),
        needsInput: tasks.filter((task) => task.state === "needs_input"),
        failed: tasks.filter((task) => task.state === "failed"),
      },
    };
  }

  createDemo() {
    const workspace = this.createWorkspace("Demo company (simulated)");
    const project = this.createProject(workspace.id, "Office setup", "A labeled demo. Both people are simulated.");
    const research = this.createEmployee(workspace.id, {
      displayName: "Simulated research",
      roleTitle: "Research (Simulated)",
      responsibilities: "Exercise the local task list. Do not treat this profile as a person or a provider.",
      instructions: "Simulated only.",
    });
    const operations = this.createEmployee(workspace.id, {
      displayName: "Simulated operations",
      roleTitle: "Operations (Simulated)",
      responsibilities: "Exercise a second local profile. This is not a second computer.",
      instructions: "Simulated only.",
    });
    this.updateEmployee(research.id, { allowedProjectIds: [project.id] });
    this.updateEmployee(operations.id, { allowedProjectIds: [project.id] });
    this.setProvider(research.id, "simulated");
    this.setProvider(operations.id, "simulated");
    const brief = this.createTask(project.id, { title: "Summarize the office move", body: "Demo brief. Nothing outside this computer is contacted." });
    const checklist = this.createTask(project.id, { title: "List the keys to collect", body: "Demo checklist." });
    this.assignTask(brief.id, research.id);
    this.queueTask(brief.id);
    this.runSimulated(brief.id);
    this.assignTask(checklist.id, operations.id);
    this.queueTask(checklist.id);
    return this.snapshot(workspace.id);
  }

  saveSubscription(input: { employeeId: string; eventName: string; callbackUrl: string; secret: string; filterJson: string; expiresAt: string }) {
    const id = crypto.createHash("sha256").update([input.employeeId, input.eventName, input.callbackUrl, input.filterJson].join("\n")).digest("hex").slice(0, 24);
    const subscriptionId = `sub_${id}`;
    const existing = this.one("SELECT secret_id FROM subscriptions WHERE id = ?", subscriptionId);
    const secretId = existing?.secret_id ? String(existing.secret_id) : idFor("sec");
    this.deps.secrets.put(secretId, "webhook", input.secret, this.nowIso());
    if (existing) {
      this.deps.db
        .prepare("UPDATE subscriptions SET secret_id = ?, expires_at = ? WHERE id = ?")
        .run(secretId, input.expiresAt, subscriptionId);
    } else {
      this.deps.db
        .prepare(
          `INSERT INTO subscriptions (id, employee_id, event_name, callback_url, secret_id, filter_json, expires_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(subscriptionId, input.employeeId, input.eventName, input.callbackUrl, secretId, input.filterJson, input.expiresAt, this.nowIso());
    }
    return { id: subscriptionId, refreshBefore: input.expiresAt };
  }

  removeSubscription(employeeId: string, subscriptionId: string) {
    const row = this.one("SELECT * FROM subscriptions WHERE id = ? AND employee_id = ?", subscriptionId, employeeId);
    if (!row) return false;
    this.deps.db.prepare("DELETE FROM subscriptions WHERE id = ?").run(subscriptionId);
    if (row.secret_id) this.deps.secrets.delete(String(row.secret_id));
    return true;
  }

  subscriptionsFor(employeeId: string) {
    return this.deps.db.prepare("SELECT * FROM subscriptions WHERE employee_id = ?").all(employeeId);
  }

  private ownedOpenTask(employeeId: string, taskId: string) {
    const task = this.task(taskId);
    const employee = this.employee(employeeId);
    this.assertCanTake(employee, task.projectId, task.workspaceId);
    if (task.assigneeId !== employeeId) throw new DomainError(403, "not_assignee", "This credential cannot update someone else's task.");
    if (["completed", "failed", "unknown"].includes(task.state)) throw new DomainError(409, "closed", "This task is not open.");
    return task;
  }

  private markUnknown(task: { id: string; workspaceId: string; state: string }, reason: string) {
    const now = this.nowIso();
    transaction(this.deps.db, () => {
      this.deps.db
        .prepare("UPDATE tasks SET state = 'unknown', unknown_reason = ?, claim_owner_id = NULL, claim_expires_at = NULL, updated_at = ? WHERE id = ?")
        .run(reason, now, task.id);
      this.event(task.id, task.workspaceId, "system", null, task.state, "unknown", reason);
    });
  }

  private assertCanTake(employee: { id: string; workspaceId: string; allowedProjectIds: string[] }, projectId: string, workspaceId: string) {
    if (employee.workspaceId !== workspaceId) throw new DomainError(403, "cross_workspace", "That person is in another company.");
    if (!employee.allowedProjectIds.includes(projectId)) {
      throw new DomainError(403, "project_not_allowed", "This person is not allowed to see that project.");
    }
  }

  private requestApproval(workspaceId: string, taskId: string | null, kind: string, summary: string) {
    const id = idFor("ap");
    const now = this.deps.now();
    const expires = new Date(now.getTime() + APPROVAL_MS).toISOString();
    this.deps.db
      .prepare(
        `INSERT INTO approvals (id, workspace_id, task_id, kind, summary, status, requested_at, expires_at, decided_at, outcome)
         VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, NULL, NULL)`,
      )
      .run(id, workspaceId, taskId, kind, summary, now.toISOString(), expires);
    return this.mustApproval(id);
  }

  private expireApprovals(workspaceId: string) {
    const now = this.nowIso();
    this.deps.db
      .prepare(
        `UPDATE approvals SET status = 'expired', decided_at = ?, outcome = ? WHERE workspace_id = ? AND status = 'pending' AND expires_at <= ?`,
      )
      .run(now, "Expired before a decision. Nothing was sent, spent, published, or deleted.", workspaceId, now);
  }

  private mustApproval(id: string) {
    const row = this.one("SELECT * FROM approvals WHERE id = ?", id);
    if (!row) throw new DomainError(404, "not_found", "That approval is not on this computer.");
    return presentApproval(row);
  }

  private eventsFor(taskId: string) {
    return this.deps.db.prepare("SELECT * FROM task_events WHERE task_id = ? ORDER BY created_at ASC").all(taskId).map(presentEvent);
  }

  private attachmentsFor(taskId: string) {
    return this.deps.db
      .prepare("SELECT id, task_id, filename, byte_size, created_at FROM attachments WHERE task_id = ? ORDER BY created_at ASC")
      .all(taskId)
      .map((row) => ({
        id: String(row.id),
        taskId: String(row.task_id),
        filename: String(row.filename),
        byteSize: Number(row.byte_size),
        createdAt: String(row.created_at),
      }));
  }

  private event(taskId: string, workspaceId: string, actorType: string, actorId: string | null, fromState: string | null, toState: string, note: string) {
    this.deps.db
      .prepare(
        `INSERT INTO task_events (id, task_id, workspace_id, actor_type, actor_id, from_state, to_state, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(idFor("ev"), taskId, workspaceId, actorType, actorId, fromState, toState, redact(note), this.nowIso());
  }

  private audit(workspaceId: string, action: string, detail: string) {
    this.deps.db.prepare("INSERT INTO audit (id, workspace_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?)").run(idFor("au"), workspaceId, action, redact(detail), this.nowIso());
  }

  private connectionSecret(employeeId: string): string | null {
    const row = this.one("SELECT secret_id FROM connections WHERE employee_id = ?", employeeId);
    return row?.secret_id ? String(row.secret_id) : null;
  }

  private one(sql: string, ...params: Array<string | number | null>): Row | undefined {
    return this.deps.db.prepare(sql).get(...params);
  }
}

function approvalOutcome(kind: string): string {
  if (kind === "delete_data") return "Approved. Roster Lab will remove the company only when you confirm the delete with this approval.";
  if (kind === "send_message") return "Approved as a record. Roster Lab did not send a message. This screen does not stop a Duet or dot from acting in its own apps.";
  if (kind === "purchase") return "Approved as a record. Roster Lab did not spend money. This screen does not stop a provider from asking for a purchase in its own app.";
  return "Approved as a record. Roster Lab did not publish anything. This screen does not stop a provider from publishing in its own apps.";
}

function computerLabel(isolation: string): string {
  if (isolation === "independent_computer_verified") {
    return "Operator-recorded isolation. Roster Lab did not observe the provider computer.";
  }
  if (isolation === "shared_computer") return "Recorded evidence says this does not meet the separate-computer requirement.";
  return "No provider computer has been demonstrated.";
}

function idFor(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(12).toString("hex")}`;
}

function requiredText(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new DomainError(400, "bad_input", `${label} is required.`);
  if (value.trim().length > max) throw new DomainError(400, "bad_input", `${label} is too long.`);
  return value.trim();
}

function text(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  if (value.length > max) throw new DomainError(400, "bad_input", "That text is too long.");
  return value;
}

function bool(value: boolean): number {
  return value ? 1 : 0;
}

function presentWorkspace(row: Row) {
  return {
    id: String(row.id),
    name: String(row.name),
    createdAt: String(row.created_at),
    approvals: {
      send: Number(row.approval_send) === 1,
      purchase: Number(row.approval_purchase) === 1,
      publish: Number(row.approval_publish) === 1,
      deleteData: Number(row.approval_delete) === 1,
    },
  };
}

function presentProject(row: Row) {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    name: String(row.name),
    summary: String(row.summary),
    goal: String(row.goal ?? ""),
    mainBotId: row.main_bot_id ? String(row.main_bot_id) : null,
    workspaceKind: String(row.workspace_kind ?? "unopened"),
    workspaceLabel: String(row.workspace_label ?? ""),
    workspaceEndpoint: row.workspace_endpoint ? String(row.workspace_endpoint) : null,
    hasFrame: Boolean(row.frame_path),
    status: String(row.status),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function presentMainBot(row: Row) {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    displayName: String(row.display_name),
    providerKind: String(row.provider_kind),
    note: String(row.note),
    credentialPrepared: Boolean(row.secret_id),
    lastMcpCallAt: row.last_mcp_call_at ? String(row.last_mcp_call_at) : null,
    createdAt: String(row.created_at),
  };
}

function presentEmployee(row: Row, connection: Row | undefined, computer: Row | undefined) {
  const providerKind = String(row.provider_kind) as ProviderKind;
  const evidence = computer?.evidence_json ? parseEvidence(JSON.parse(String(computer.evidence_json))) : null;
  const decision = evidence ? evaluateEvidence(providerKind, evidence) : null;
  const isolation = computer ? String(computer.isolation) : "not_connected";
  const badge =
    decision?.badge && isolation === "independent_computer_verified"
      ? decision.badge
      : null;
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    displayName: String(row.display_name),
    roleTitle: String(row.role_title),
    responsibilities: String(row.responsibilities),
    instructions: String(row.instructions),
    providerKind,
    allowedProjectIds: JSON.parse(String(row.allowed_projects)) as string[],
    connection: connection
      ? {
          id: String(connection.id),
          provider: String(connection.provider),
          status: String(connection.status),
          credentialPrepared: Boolean(connection.secret_id) && !connection.revoked_at,
          lastMcpCallAt: connection.last_mcp_call_at ? String(connection.last_mcp_call_at) : null,
          revokedAt: connection.revoked_at ? String(connection.revoked_at) : null,
          note: String(connection.note),
        }
      : null,
    computer: {
      id: computer ? String(computer.id) : null,
      kind: computer ? String(computer.kind) : "none",
      label: computer ? String(computer.label) : "No computer is attached.",
      isolation,
      lastConfirmedAt: computer?.last_confirmed_at ? String(computer.last_confirmed_at) : null,
      evidence: evidence as IsolationEvidence | null,
      badge,
    },
    capabilities: capabilitiesFor(providerKind),
  };
}

function presentTask(row: Row, events: ReturnType<typeof presentEvent>[], attachments: Array<{ id: string; taskId: string; filename: string; byteSize: number; createdAt: string }>) {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    projectId: String(row.project_id),
    title: String(row.title),
    body: String(row.body),
    assigneeId: row.assignee_id ? String(row.assignee_id) : null,
    state: String(row.state),
    claimOwnerId: row.claim_owner_id ? String(row.claim_owner_id) : null,
    claimExpiresAt: row.claim_expires_at ? String(row.claim_expires_at) : null,
    resultBody: row.result_body ? String(row.result_body) : null,
    resultLabel: row.result_label ? String(row.result_label) : null,
    resultKey: row.result_key ? String(row.result_key) : null,
    unknownReason: row.unknown_reason ? String(row.unknown_reason) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    events,
    attachments,
  };
}

function presentEvent(row: Row) {
  return {
    id: String(row.id),
    taskId: String(row.task_id),
    workspaceId: String(row.workspace_id),
    actorType: String(row.actor_type),
    actorId: row.actor_id ? String(row.actor_id) : null,
    fromState: row.from_state ? String(row.from_state) : null,
    toState: String(row.to_state),
    note: String(row.note),
    createdAt: String(row.created_at),
  };
}

function presentApproval(row: Row) {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    taskId: row.task_id ? String(row.task_id) : null,
    kind: String(row.kind),
    summary: String(row.summary),
    status: String(row.status),
    requestedAt: String(row.requested_at),
    expiresAt: String(row.expires_at),
    decidedAt: row.decided_at ? String(row.decided_at) : null,
    outcome: row.outcome ? String(row.outcome) : null,
  };
}

function presentAudit(row: Row) {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    action: String(row.action),
    detail: String(row.detail),
    createdAt: String(row.created_at),
  };
}
