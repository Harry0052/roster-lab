import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { capabilitiesFor } from "./capabilities.ts";
import { deliverQueued, handleMcp } from "./mcp.ts";
import { DomainError, type RosterStore } from "./store.ts";

const MAX_BODY = 1_000_000;

type Ctx = {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  url: URL;
  store: RosterStore;
  port: number;
  fetchImpl: typeof fetch;
  allowLoopbackCallbacks: boolean;
  distDir: string | null;
  dataDir: string;
};

export function createHandler(options: {
  store: RosterStore;
  port: number;
  fetchImpl?: typeof fetch;
  allowLoopbackCallbacks?: boolean;
  distDir?: string | null;
  dataDir: string;
}) {
  return async function handler(req: http.IncomingMessage, res: http.ServerResponse) {
    const host = req.headers.host ?? `127.0.0.1:${options.port}`;
    const url = new URL(req.url ?? "/", `http://${host}`);
    const ctx: Ctx = {
      req,
      res,
      url,
      store: options.store,
      port: options.port,
      fetchImpl: options.fetchImpl ?? fetch,
      allowLoopbackCallbacks: options.allowLoopbackCallbacks ?? false,
      distDir: options.distDir ?? null,
      dataDir: options.dataDir,
    };
    try {
      if (req.method === "OPTIONS") {
        send(res, 204, null);
        return;
      }
      if (url.pathname === "/mcp") {
        await mcp(ctx);
        return;
      }
      if (url.pathname.startsWith("/api/")) {
        guardCsrf(ctx);
        await api(ctx);
        return;
      }
      if (req.method === "GET" && ctx.distDir) {
        serveStatic(ctx);
        return;
      }
      send(res, 404, { error: { code: "not_found", message: "Not found." } });
    } catch (error) {
      if (error instanceof DomainError) {
        send(res, error.status, { error: { code: error.code, message: error.message } });
        return;
      }
      console.error(`request failed ${req.method} ${url.pathname}`);
      send(res, 500, { error: { code: "internal", message: "Something went wrong on this computer. The details were not shown here." } });
    }
  };
}

async function api(ctx: Ctx) {
  const { req, url, store } = ctx;
  const method = req.method ?? "GET";
  const parts = url.pathname.split("/").filter(Boolean);

  if (method === "GET" && url.pathname === "/api/health") {
    send(ctx.res, 200, { ok: true, service: "roster-lab", bind: "127.0.0.1" });
    return;
  }
  if (method === "GET" && url.pathname === "/api/meta") {
    send(ctx.res, 200, {
      dataDir: ctx.dataDir,
      bind: "127.0.0.1",
      port: ctx.port,
      secretStorage: "A secrets.json file in the data directory, mode 0600. Not the macOS Keychain.",
      liveProviders: "Not live-tested",
    });
    return;
  }
  if (method === "GET" && url.pathname === "/api/capabilities") {
    send(ctx.res, 200, {
      providers: {
        none: capabilitiesFor("none"),
        simulated: capabilitiesFor("simulated"),
        "claude-duet": capabilitiesFor("claude-duet"),
        "openai-dot": capabilitiesFor("openai-dot"),
      },
    });
    return;
  }
  if (method === "POST" && url.pathname === "/api/demo") {
    send(ctx.res, 201, store.createDemo());
    return;
  }
  if (method === "GET" && url.pathname === "/api/workspaces") {
    send(ctx.res, 200, { workspaces: store.listWorkspaces() });
    return;
  }
  if (method === "POST" && url.pathname === "/api/workspaces") {
    const body = await readJson(req);
    send(ctx.res, 201, store.createWorkspace(stringField(body, "name")));
    return;
  }
  if (parts[0] === "api" && parts[1] === "workspaces" && parts.length === 3 && method === "GET") {
    send(ctx.res, 200, store.snapshot(parts[2]));
    return;
  }
  if (parts[0] === "api" && parts[1] === "workspaces" && parts[3] === "export" && method === "GET") {
    send(ctx.res, 200, store.exportWorkspace(parts[2]));
    return;
  }
  if (parts[0] === "api" && parts[1] === "workspaces" && parts[3] === "approvals" && method === "PATCH") {
    const body = await readJson(req);
    send(ctx.res, 200, store.updateApprovals(parts[2], {
      send: boolField(body, "send"),
      purchase: boolField(body, "purchase"),
      publish: boolField(body, "publish"),
      deleteData: boolField(body, "deleteData"),
    }));
    return;
  }
  if (parts[0] === "api" && parts[1] === "workspaces" && parts.length === 3 && method === "DELETE") {
    const body = await readJson(req);
    const approvalId = typeof body.approvalId === "string" ? body.approvalId : undefined;
    send(ctx.res, 200, store.deleteWorkspace(parts[2], approvalId));
    return;
  }
  if (parts[0] === "api" && parts[1] === "workspaces" && parts[3] === "projects" && method === "POST") {
    const body = await readJson(req);
    send(ctx.res, 201, store.createProject(parts[2], stringField(body, "name"), optionalString(body, "summary")));
    return;
  }
  if (parts[0] === "api" && parts[1] === "workspaces" && parts[3] === "employees" && method === "POST") {
    const body = await readJson(req);
    send(ctx.res, 201, store.createEmployee(parts[2], {
      displayName: stringField(body, "displayName"),
      roleTitle: stringField(body, "roleTitle"),
      responsibilities: optionalString(body, "responsibilities"),
      instructions: optionalString(body, "instructions"),
    }));
    return;
  }
  if (parts[0] === "api" && parts[1] === "workspaces" && parts[3] === "mediated" && method === "POST") {
    const body = await readJson(req);
    send(ctx.res, 201, store.requestMediated(parts[2], typeof body.taskId === "string" ? body.taskId : null, stringField(body, "kind"), stringField(body, "summary")));
    return;
  }
  if (parts[0] === "api" && parts[1] === "projects" && parts.length === 3 && method === "PATCH") {
    const body = await readJson(req);
    send(ctx.res, 200, store.updateProject(parts[2], body as { name?: string; summary?: string; status?: string }));
    return;
  }
  if (parts[0] === "api" && parts[1] === "projects" && parts[3] === "tasks" && method === "POST") {
    const body = await readJson(req);
    send(ctx.res, 201, store.createTask(parts[2], { title: stringField(body, "title"), body: optionalString(body, "body") }));
    return;
  }
  if (parts[0] === "api" && parts[1] === "employees" && parts.length === 3 && method === "GET") {
    send(ctx.res, 200, store.employee(parts[2]));
    return;
  }
  if (parts[0] === "api" && parts[1] === "employees" && parts.length === 3 && method === "PATCH") {
    const body = await readJson(req);
    send(ctx.res, 200, store.updateEmployee(parts[2], {
      displayName: optionalString(body, "displayName") || undefined,
      roleTitle: optionalString(body, "roleTitle") || undefined,
      responsibilities: body.responsibilities === undefined ? undefined : optionalString(body, "responsibilities"),
      instructions: body.instructions === undefined ? undefined : optionalString(body, "instructions"),
      allowedProjectIds: Array.isArray(body.allowedProjectIds) ? body.allowedProjectIds.filter((item): item is string => typeof item === "string") : undefined,
    }));
    return;
  }
  if (parts[0] === "api" && parts[1] === "employees" && parts[3] === "provider" && method === "POST") {
    const body = await readJson(req);
    send(ctx.res, 200, store.setProvider(parts[2], stringField(body, "kind")));
    return;
  }
  if (parts[0] === "api" && parts[1] === "employees" && parts[3] === "credential" && method === "POST") {
    send(ctx.res, 201, store.prepareCredential(parts[2]));
    return;
  }
  if (parts[0] === "api" && parts[1] === "employees" && parts[3] === "credential" && method === "DELETE") {
    send(ctx.res, 200, store.revokeCredential(parts[2]));
    return;
  }
  if (parts[0] === "api" && parts[1] === "employees" && parts[3] === "evidence" && method === "POST") {
    const body = await readJson(req);
    send(ctx.res, 200, store.recordEvidence(parts[2], body.evidence));
    return;
  }
  if (parts[0] === "api" && parts[1] === "tasks" && parts.length === 3 && method === "GET") {
    send(ctx.res, 200, store.task(parts[2]));
    return;
  }
  if (parts[0] === "api" && parts[1] === "tasks" && parts.length === 3 && method === "PATCH") {
    const body = await readJson(req);
    send(ctx.res, 200, store.updateTask(parts[2], { title: optionalString(body, "title") || undefined, body: body.body === undefined ? undefined : optionalString(body, "body") }));
    return;
  }
  if (parts[0] === "api" && parts[1] === "tasks" && parts[3] === "assign" && method === "POST") {
    const body = await readJson(req);
    send(ctx.res, 200, store.assignTask(parts[2], stringField(body, "employeeId")));
    return;
  }
  if (parts[0] === "api" && parts[1] === "tasks" && parts[3] === "queue" && method === "POST") {
    const task = store.queueTask(parts[2]);
    const delivery = await deliverQueued(store, task.id, ctx.fetchImpl);
    send(ctx.res, 200, { task: store.task(task.id), delivery });
    return;
  }
  if (parts[0] === "api" && parts[1] === "tasks" && parts[3] === "handoff" && method === "POST") {
    const body = await readJson(req);
    send(ctx.res, 200, store.handoff(parts[2], stringField(body, "employeeId"), stringField(body, "note")));
    return;
  }
  if (parts[0] === "api" && parts[1] === "tasks" && parts[3] === "cancel" && method === "POST") {
    send(ctx.res, 200, store.cancelLocal(parts[2]));
    return;
  }
  if (parts[0] === "api" && parts[1] === "tasks" && parts[3] === "reconcile" && method === "POST") {
    const body = await readJson(req);
    send(ctx.res, 200, store.reconcile(parts[2], stringField(body, "choice"), stringField(body, "note")));
    return;
  }
  if (parts[0] === "api" && parts[1] === "tasks" && parts[3] === "simulate" && method === "POST") {
    send(ctx.res, 200, store.runSimulated(parts[2]));
    return;
  }
  if (parts[0] === "api" && parts[1] === "tasks" && parts[3] === "attachments" && method === "POST") {
    const body = await readJson(req);
    send(ctx.res, 201, store.addAttachment(parts[2], stringField(body, "filename"), stringField(body, "contentBase64")));
    return;
  }
  if (parts[0] === "api" && parts[1] === "attachments" && method === "GET") {
    const file = store.attachment(parts[2]);
    send(ctx.res, 200, file);
    return;
  }
  if (parts[0] === "api" && parts[1] === "approvals" && parts.length === 3 && method === "POST") {
    const body = await readJson(req);
    send(ctx.res, 200, store.decideApproval(parts[2], stringField(body, "decision")));
    return;
  }
  throw new DomainError(404, "not_found", "That action is not available.");
}

async function mcp(ctx: Ctx) {
  if (ctx.req.method !== "POST") throw new DomainError(405, "method", "The MCP endpoint accepts POST.");
  const header = ctx.req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  const found = token ? ctx.store.employeeByToken(token) : null;
  if (!found) throw new DomainError(401, "unauthorized", "This connector credential was missing, revoked, or never issued.");
  const message = await readJson(ctx.req);
  const result = await handleMcp(ctx.store, found.employee.id, message as { jsonrpc?: string; id?: unknown; method?: string; params?: Record<string, unknown> }, ctx.allowLoopbackCallbacks, ctx.fetchImpl);
  send(ctx.res, 200, result);
}

function guardCsrf(ctx: Ctx) {
  if (ctx.req.method === "GET" || ctx.req.method === "HEAD") return;
  if (ctx.req.headers["x-roster-request"] !== "1") {
    throw new DomainError(403, "csrf", "Refused a change that did not come from Roster Lab.");
  }
  const origin = ctx.req.headers.origin;
  if (typeof origin === "string" && origin.length > 0) {
    const allowed = new Set([
      `http://127.0.0.1:${ctx.port}`,
      `http://localhost:${ctx.port}`,
      "http://127.0.0.1:4318",
      "http://localhost:4318",
    ]);
    if (!allowed.has(origin)) throw new DomainError(403, "csrf", "This page’s origin is not allowed to change Roster Lab.");
  }
}

function serveStatic(ctx: Ctx) {
  if (!ctx.distDir) return;
  const relative = ctx.url.pathname === "/" ? "index.html" : ctx.url.pathname.replace(/^\/+/, "");
  const file = path.resolve(ctx.distDir, relative);
  const root = path.resolve(ctx.distDir);
  if (!file.startsWith(`${root}${path.sep}`) && file !== root) {
    send(ctx.res, 403, { error: { code: "forbidden", message: "That file is outside the app." } });
    return;
  }
  const target = fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(root, "index.html");
  if (!fs.existsSync(target)) {
    send(ctx.res, 404, { error: { code: "not_found", message: "The interface has not been built." } });
    return;
  }
  const ext = path.extname(target);
  const types: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".json": "application/json",
  };
  ctx.res.writeHead(200, { "content-type": types[ext] ?? "application/octet-stream", "cache-control": "no-store" });
  fs.createReadStream(target).pipe(ctx.res);
}

async function readJson(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY) throw new DomainError(413, "too_large", "That request is larger than 1000000 bytes.");
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("object");
    return parsed as Record<string, unknown>;
  } catch {
    throw new DomainError(400, "bad_json", "The request body was not a JSON object.");
  }
}

function stringField(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string") throw new DomainError(400, "bad_input", `${key} is required.`);
  return value;
}

function optionalString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === "string" ? value : "";
}

function boolField(body: Record<string, unknown>, key: string): boolean {
  if (typeof body[key] !== "boolean") throw new DomainError(400, "bad_input", `${key} must be true or false.`);
  return body[key] as boolean;
}

function send(res: http.ServerResponse, status: number, body: unknown) {
  if (body === null) {
    res.writeHead(status, { "content-length": "0", "x-content-type-options": "nosniff" });
    res.end();
    return;
  }
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
  });
  res.end(payload);
}
