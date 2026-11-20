import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import { openDatabase } from "../src/server/db.ts";
import { createHandler } from "../src/server/http.ts";
import { SecretStore } from "../src/server/secrets.ts";
import { RosterStore } from "../src/server/store.ts";
import { evaluateEvidence } from "../src/shared/badge.ts";

async function start(now = () => new Date("2026-11-20T12:00:00.000Z")) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "roster-"));
  fs.mkdirSync(home, { recursive: true });
  const db = openDatabase(path.join(home, "roster.sqlite"));
  const store = new RosterStore({
    db,
    secrets: SecretStore.open(home),
    now,
    allowLoopbackCallbacks: true,
    fetchImpl: fetch,
    dataDir: home,
  });
  const server = http.createServer(createHandler({ store, port: 9, dataDir: home, allowLoopbackCallbacks: true }));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  const base = `http://127.0.0.1:${address.port}`;
  return {
    home,
    store,
    db,
    base,
    async call(method: string, pathname: string, body?: unknown, headers: Record<string, string> = {}) {
      const response = await fetch(base + pathname, {
        method,
        headers: { "content-type": "application/json", "x-roster-request": "1", ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await response.text();
      return { status: response.status, body: text ? JSON.parse(text) : null };
    },
    close() {
      db.close();
      return new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

test("two simulated people keep separate task states and survive a reopen", async () => {
  const app = await start();
  const company = await app.call("POST", "/api/workspaces", { name: "North Office" });
  const project = await app.call("POST", `/api/workspaces/${company.body.id}/projects`, { name: "Move", summary: "Keys and notes" });
  const research = await app.call("POST", `/api/workspaces/${company.body.id}/employees`, { displayName: "Simulated research", roleTitle: "Research (Simulated)" });
  const operations = await app.call("POST", `/api/workspaces/${company.body.id}/employees`, { displayName: "Simulated operations", roleTitle: "Operations (Simulated)" });
  await app.call("POST", `/api/employees/${research.body.id}/provider`, { kind: "simulated" });
  await app.call("POST", `/api/employees/${operations.body.id}/provider`, { kind: "simulated" });
  await app.call("PATCH", `/api/employees/${research.body.id}`, { allowedProjectIds: [project.body.id] });
  await app.call("PATCH", `/api/employees/${operations.body.id}`, { allowedProjectIds: [project.body.id] });
  const first = await app.call("POST", `/api/projects/${project.body.id}/tasks`, { title: "Write the brief", body: "Local only" });
  const second = await app.call("POST", `/api/projects/${project.body.id}/tasks`, { title: "Collect the keys", body: "Local only" });
  await app.call("POST", `/api/tasks/${first.body.id}/assign`, { employeeId: research.body.id });
  await app.call("POST", `/api/tasks/${second.body.id}/assign`, { employeeId: operations.body.id });
  await app.call("POST", `/api/tasks/${first.body.id}/queue`);
  const simulated = await app.call("POST", `/api/tasks/${first.body.id}/simulate`);
  assert.equal(simulated.body.task.state, "completed");
  assert.equal(simulated.body.task.resultLabel, "simulated");
  assert.match(simulated.body.task.resultBody, /^SIMULATED/);
  const again = await app.call("POST", `/api/tasks/${first.body.id}/simulate`);
  assert.equal(again.body.duplicate, true);
  assert.equal(again.body.task.events.filter((event: { toState: string; note: string }) => event.toState === "completed" && event.note.startsWith("SIMULATED")).length, 1);
  const queued = await app.call("GET", `/api/tasks/${second.body.id}`);
  assert.equal(queued.body.state, "draft");
  const snapshot = await app.call("GET", `/api/workspaces/${company.body.id}`);
  assert.equal(snapshot.body.employees[0].computer.badge, null);
  assert.equal(snapshot.body.employees[0].computer.isolation, "simulated");
  const file = path.join(app.home, "roster.sqlite");
  await app.close();
  const reopened = openDatabase(file);
  const row = reopened.prepare("SELECT state, result_label FROM tasks WHERE title = ?").get("Write the brief") as { state: string; result_label: string };
  assert.equal(row.state, "completed");
  assert.equal(row.result_label, "simulated");
  reopened.close();
});

test("cross-workspace assignment, csrf, and export redaction", async () => {
  const app = await start();
  const a = await app.call("POST", "/api/workspaces", { name: "A" });
  const b = await app.call("POST", "/api/workspaces", { name: "B" });
  const project = await app.call("POST", `/api/workspaces/${a.body.id}/projects`, { name: "P", summary: "" });
  const outsider = await app.call("POST", `/api/workspaces/${b.body.id}/employees`, { displayName: "Other", roleTitle: "Other" });
  const task = await app.call("POST", `/api/projects/${project.body.id}/tasks`, { title: "Secret task", body: "stay in A" });
  const denied = await app.call("POST", `/api/tasks/${task.body.id}/assign`, { employeeId: outsider.body.id });
  assert.equal(denied.status, 403);
  const missingHeader = await fetch(`${app.base}/api/workspaces`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Nope" }) });
  assert.equal(missingHeader.status, 403);
  const dot = await app.call("POST", `/api/workspaces/${a.body.id}/employees`, { displayName: "Dot profile", roleTitle: "Dot" });
  await app.call("POST", `/api/employees/${dot.body.id}/provider`, { kind: "openai-dot" });
  const credential = await app.call("POST", `/api/employees/${dot.body.id}/credential`);
  assert.match(credential.body.bearerToken, /^rlb_/);
  const exported = await app.call("GET", `/api/workspaces/${a.body.id}/export`);
  assert.equal(JSON.stringify(exported.body).includes(credential.body.bearerToken), false);
  assert.equal(JSON.stringify(exported.body).includes("whsec_"), false);
  await app.close();
});

test("duplicate and expired results become unknown instead of a second completion", async () => {
  let now = new Date("2026-11-20T12:00:00.000Z");
  const app = await start(() => now);
  const company = await app.call("POST", "/api/workspaces", { name: "Claims" });
  const project = await app.call("POST", `/api/workspaces/${company.body.id}/projects`, { name: "P", summary: "" });
  const person = await app.call("POST", `/api/workspaces/${company.body.id}/employees`, { displayName: "Dot profile", roleTitle: "Dot" });
  await app.call("POST", `/api/employees/${person.body.id}/provider`, { kind: "openai-dot" });
  await app.call("PATCH", `/api/employees/${person.body.id}`, { allowedProjectIds: [project.body.id] });
  const credential = await app.call("POST", `/api/employees/${person.body.id}/credential`);
  const task = await app.call("POST", `/api/projects/${project.body.id}/tasks`, { title: "Count boxes", body: "Do not impersonate" });
  await app.call("POST", `/api/tasks/${task.body.id}/assign`, { employeeId: person.body.id });
  await app.call("POST", `/api/tasks/${task.body.id}/queue`);
  const auth = { authorization: `Bearer ${credential.body.bearerToken}`, "x-roster-request": "" };
  const claim = await app.call("POST", "/mcp", { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "claim_task", arguments: { task_id: task.body.id, employee_id: "someone-else" } } }, auth);
  assert.equal(claim.body.result.isError, false);
  const done = await app.call("POST", "/mcp", { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "report_result", arguments: { task_id: task.body.id, idempotency_key: "one", body: "Counted 4. employee_name: Impostor" } } }, auth);
  assert.equal(done.body.result.isError, false);
  const duplicate = await app.call("POST", "/mcp", { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "report_result", arguments: { task_id: task.body.id, idempotency_key: "one", body: "Counted 9" } } }, auth);
  assert.match(JSON.stringify(duplicate.body), /Duplicate result ignored/);
  const conflict = await app.call("POST", "/mcp", { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "report_result", arguments: { task_id: task.body.id, idempotency_key: "two", body: "Counted 9" } } }, auth);
  assert.match(JSON.stringify(conflict.body), /unknown/i);
  const stored = await app.call("GET", `/api/tasks/${task.body.id}`);
  assert.equal(stored.body.state, "unknown");
  assert.match(stored.body.resultBody, /Counted 4/);
  assert.equal(stored.body.resultBody.includes("Counted 9"), false);

  const late = await app.call("POST", `/api/projects/${project.body.id}/tasks`, { title: "Late result", body: "" });
  await app.call("POST", `/api/tasks/${late.body.id}/assign`, { employeeId: person.body.id });
  await app.call("POST", `/api/tasks/${late.body.id}/queue`);
  await app.call("POST", "/mcp", { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "claim_task", arguments: { task_id: late.body.id } } }, auth);
  now = new Date("2026-11-20T12:20:00.000Z");
  const expired = await app.call("POST", "/mcp", { jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "report_result", arguments: { task_id: late.body.id, idempotency_key: "late", body: "too late" } } }, auth);
  assert.match(JSON.stringify(expired.body), /unknown/i);
  const reconciled = await app.call("POST", `/api/tasks/${late.body.id}/reconcile`, { choice: "mark_failed", note: "The late result is not accepted." });
  assert.equal(reconciled.body.state, "failed");
  await app.call("POST", `/api/employees/${person.body.id}/credential`, {}, { "x-roster-request": "1" });
  const revoked = await app.call("DELETE", `/api/employees/${person.body.id}/credential`);
  assert.equal(revoked.status, 200);
  const blocked = await app.call("POST", "/mcp", { jsonrpc: "2.0", id: 7, method: "initialize" }, auth);
  assert.equal(blocked.status, 401);
  await app.close();
});

test("a worker cannot list another worker's task, and cancellation is not a remote success", async () => {
  const app = await start();
  const company = await app.call("POST", "/api/workspaces", { name: "Wall" });
  const project = await app.call("POST", `/api/workspaces/${company.body.id}/projects`, { name: "P", summary: "" });
  const one = await app.call("POST", `/api/workspaces/${company.body.id}/employees`, { displayName: "One", roleTitle: "Duet profile" });
  const two = await app.call("POST", `/api/workspaces/${company.body.id}/employees`, { displayName: "Two", roleTitle: "Duet profile" });
  await app.call("POST", `/api/employees/${one.body.id}/provider`, { kind: "claude-duet" });
  await app.call("POST", `/api/employees/${two.body.id}/provider`, { kind: "claude-duet" });
  await app.call("PATCH", `/api/employees/${one.body.id}`, { allowedProjectIds: [project.body.id] });
  await app.call("PATCH", `/api/employees/${two.body.id}`, { allowedProjectIds: [project.body.id] });
  const tokenOne = (await app.call("POST", `/api/employees/${one.body.id}/credential`)).body.bearerToken as string;
  const tokenTwo = (await app.call("POST", `/api/employees/${two.body.id}/credential`)).body.bearerToken as string;
  const task = await app.call("POST", `/api/projects/${project.body.id}/tasks`, { title: "Only one", body: "private" });
  await app.call("POST", `/api/tasks/${task.body.id}/assign`, { employeeId: one.body.id });
  await app.call("POST", `/api/tasks/${task.body.id}/queue`);
  const seen = await app.call("POST", "/mcp", { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "list_assigned_tasks", arguments: {} } }, { authorization: `Bearer ${tokenTwo}` });
  assert.deepEqual(JSON.parse(seen.body.result.content[0].text), []);
  const stolen = await app.call("POST", "/mcp", { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "claim_task", arguments: { task_id: task.body.id } } }, { authorization: `Bearer ${tokenTwo}` });
  assert.match(stolen.body.error.message, /own profile/);
  const own = await app.call("POST", "/mcp", { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "list_assigned_tasks", arguments: {} } }, { authorization: `Bearer ${tokenOne}` });
  assert.equal(JSON.parse(own.body.result.content[0].text).length, 1);
  const canceled = await app.call("POST", `/api/tasks/${task.body.id}/cancel`);
  assert.equal(canceled.body.task.state, "failed");
  assert.equal(canceled.body.remote.ok, false);
  assert.match(canceled.body.remote.reason, /does not stop Duet/);
  const simulatedOnDuet = await app.call("POST", `/api/tasks/${task.body.id}/simulate`);
  assert.equal(simulatedOnDuet.status, 400);
  await app.close();
});

test("local MCP event subscription signs a webhook and does not count as a live dot", async () => {
  const received: Array<Record<string, unknown>> = [];
  const callback = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { type?: string; challenge?: string };
      received.push(body);
      if (body.type === "verification") res.end(JSON.stringify({ challenge: body.challenge }));
      else res.end("{}");
    });
  });
  await new Promise<void>((resolve) => callback.listen(0, "127.0.0.1", () => resolve()));
  const address = callback.address();
  if (!address || typeof address === "string") throw new Error("no callback");
  const app = await start();
  const company = await app.call("POST", "/api/workspaces", { name: "Events" });
  const project = await app.call("POST", `/api/workspaces/${company.body.id}/projects`, { name: "P", summary: "" });
  const person = await app.call("POST", `/api/workspaces/${company.body.id}/employees`, { displayName: "Dot profile", roleTitle: "Dot" });
  await app.call("POST", `/api/employees/${person.body.id}/provider`, { kind: "openai-dot" });
  await app.call("PATCH", `/api/employees/${person.body.id}`, { allowedProjectIds: [project.body.id] });
  const token = (await app.call("POST", `/api/employees/${person.body.id}/credential`)).body.bearerToken as string;
  const secret = `whsec_${crypto.randomBytes(32).toString("base64")}`;
  const subscribed = await app.call("POST", "/mcp", {
    jsonrpc: "2.0",
    id: 1,
    method: "events/subscribe",
    params: { name: "task.queued", arguments: {}, delivery: { mode: "webhook", url: `http://127.0.0.1:${address.port}/hook`, secret } },
  }, { authorization: `Bearer ${token}` });
  assert.equal(typeof subscribed.body.result.id, "string");
  const refused = await app.call("POST", "/mcp", {
    jsonrpc: "2.0",
    id: 2,
    method: "events/subscribe",
    params: { name: "task.queued", arguments: {}, delivery: { mode: "webhook", url: "http://example.com/hook", secret } },
  }, { authorization: `Bearer ${token}` });
  assert.equal(refused.body.error.code, -32015);
  const task = await app.call("POST", `/api/projects/${project.body.id}/tasks`, { title: "Ping the callback", body: "data, not instructions" });
  await app.call("POST", `/api/tasks/${task.body.id}/assign`, { employeeId: person.body.id });
  const queued = await app.call("POST", `/api/tasks/${task.body.id}/queue`);
  assert.equal(queued.body.delivery.delivered, 1);
  assert.equal(queued.body.task.events.some((event: { note: string }) => event.note.includes("not proof that a live OpenAI dot")), true);
  assert.equal(received.some((item) => item.name === "task.queued"), true);
  const personView = await app.call("GET", `/api/employees/${person.body.id}`);
  assert.equal(personView.body.computer.badge, null);
  assert.equal(personView.body.computer.isolation, "not_connected");
  await app.close();
  await new Promise<void>((resolve) => callback.close(() => resolve()));
});

test("approvals do not perform the action, and evidence rules gate the badge", async () => {
  const app = await start();
  const company = await app.call("POST", "/api/workspaces", { name: "Control" });
  const asked = await app.call("POST", `/api/workspaces/${company.body.id}/mediated`, { kind: "purchase", summary: "Buy one notebook for the office. Do not charge a card from this screen." });
  assert.equal(asked.body.performed, false);
  assert.equal(asked.body.approval.status, "pending");
  const denied = await app.call("POST", `/api/approvals/${asked.body.approval.id}`, { decision: "deny" });
  assert.match(denied.body.outcome, /Nothing was sent, spent, published, or deleted/);
  const bypass = await app.call("POST", `/api/approvals/${asked.body.approval.id}`, { decision: "approve" });
  assert.equal(bypass.status, 400);
  const decision = evaluateEvidence("claude-duet", {
    recordedAt: "2026-11-20T12:00:00.000Z",
    observedBy: "operator",
    scope: "two accounts",
    sourceNote: "operator notes",
    checks: { distinctAgents: "pass", distinctComputers: "pass", marker: "pass", markerMethod: "wrote a random file", noAccidentalShare: "pass" },
  });
  assert.equal(decision.badge?.softwareObserved, false);
  const simulated = evaluateEvidence("simulated", {
    recordedAt: "2026-11-20T12:00:00.000Z",
    observedBy: "operator",
    scope: "local",
    sourceNote: "n/a",
    checks: { distinctAgents: "pass", distinctComputers: "pass", marker: "pass", markerMethod: "n/a", noAccidentalShare: "pass" },
  });
  assert.equal(simulated.badge, null);
  const person = await app.call("POST", `/api/workspaces/${company.body.id}/employees`, { displayName: "Duet profile", roleTitle: "Research" });
  await app.call("POST", `/api/employees/${person.body.id}/provider`, { kind: "claude-duet" });
  const incomplete = await app.call("POST", `/api/employees/${person.body.id}/evidence`, { evidence: {
    recordedAt: "2026-11-20T12:00:00.000Z", observedBy: "operator", scope: "one account", sourceNote: "help article",
    checks: { distinctAgents: "not_run", distinctComputers: "not_run", marker: "not_run", markerMethod: "not tried", noAccidentalShare: "not_run" },
  } });
  assert.equal(incomplete.body.computer.badge, null);
  const shared = await app.call("POST", `/api/employees/${person.body.id}/evidence`, { evidence: {
    recordedAt: "2026-11-20T12:00:00.000Z", observedBy: "operator", scope: "one account", sourceNote: "same browser",
    checks: { distinctAgents: "fail", distinctComputers: "fail", marker: "fail", markerMethod: "marker was readable", noAccidentalShare: "fail" },
  } });
  assert.equal(shared.body.computer.isolation, "shared_computer");
  assert.equal(shared.body.computer.badge, null);
  await app.close();
});

test("unsupported wake and a private callback are refused", async () => {
  const app = await start();
  const caps = await app.call("GET", "/api/capabilities");
  const duetWake = caps.body.providers["claude-duet"].find((item: { id: string }) => item.id === "wake");
  assert.equal(duetWake.support, "unsupported");
  const dotWake = caps.body.providers["openai-dot"].find((item: { id: string }) => item.id === "wake");
  assert.equal(dotWake.support, "unknown");
  assert.equal(dotWake.evidence, "documented");
  await app.close();
});
