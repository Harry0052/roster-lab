import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { openDatabase } from "../src/server/db.ts";
import { handleMainMcp } from "../src/server/mcp.ts";
import { SecretStore } from "../src/server/secrets.ts";
import { RosterStore } from "../src/server/store.ts";
import { dockerAvailable, findChrome, LOCAL_BROWSER_LABEL } from "../src/server/workspace-runner.ts";

function storeAt(home: string) {
  fs.mkdirSync(home, { recursive: true });
  const db = openDatabase(path.join(home, "roster.sqlite"));
  const store = new RosterStore({
    db,
    secrets: SecretStore.open(home),
    now: () => new Date("2026-11-20T12:00:00.000Z"),
    allowLoopbackCallbacks: false,
    fetchImpl: fetch,
    dataDir: home,
  });
  return { db, store };
}

test("docker is not required to choose the labeled local browser", () => {
  assert.equal(dockerAvailable(), false);
  assert.equal(LOCAL_BROWSER_LABEL, "local browser, not isolated VM");
  assert.equal(findChrome() !== null, true);
});

test("main bot delegates to Software Engineer and Chrome writes a per-project capture", { timeout: 60000 }, async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "roster-ws-"));
  const { db, store } = storeAt(home);
  const snapshot = await store.createMainBotDemo();
  assert.equal(snapshot.mainBots.length, 1);
  assert.equal(snapshot.mainBots[0]?.providerKind, "simulated");
  const project = snapshot.projects.find((item) => item.name === "Software Engineer");
  assert.ok(project);
  assert.equal(project.workspaceLabel, LOCAL_BROWSER_LABEL);
  assert.equal(project.workspaceKind, "local_browser");
  assert.equal(project.goal.length > 0, true);
  const task = snapshot.tasks.find((item) => item.projectId === project.id);
  assert.ok(task);
  assert.equal(task.state, "completed");
  assert.equal(task.resultLabel, "local_browser");
  assert.match(task.resultBody ?? "", /local browser, not isolated VM/);
  const note = fs.readFileSync(path.join(home, "project-files", project.id, "note.txt"), "utf8");
  assert.match(note, /Software Engineer/);
  const frame = store.framePath(project.id);
  assert.ok(frame);
  assert.equal(fs.statSync(frame).size > 1000, true);
  const audit = snapshot.activity.filter((item) => item.kind === "audit").map((item) => item.detail ?? "");
  assert.equal(audit.some((line) => line.includes("delegated")), true);
  assert.equal(audit.some((line) => line.includes(LOCAL_BROWSER_LABEL)), true);

  const other = store.createProject(snapshot.workspace.id, "Second desk", "Another profile", { mainBotId: snapshot.mainBots[0]?.id, goal: "Stay separate" });
  fs.writeFileSync(path.join(home, "browser-profiles", project.id, "marker-from-a.txt"), "only-a");
  assert.equal(fs.existsSync(path.join(home, "browser-profiles", other.id, "marker-from-a.txt")), false);
  const credential = store.prepareMainCredential(snapshot.mainBots[0]?.id ?? "");
  const listed = await handleMainMcp(store, snapshot.mainBots[0]?.id ?? "", {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "list_projects", arguments: {} },
  });
  assert.match(JSON.stringify(listed), /Software Engineer/);
  const status = await handleMainMcp(store, snapshot.mainBots[0]?.id ?? "", {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "get_task_status", arguments: { task_id: task.id } },
  });
  assert.match(JSON.stringify(status), /completed/);
  assert.equal(credential.bearerToken.startsWith("rlb_"), true);
  assert.equal(JSON.stringify(store.exportWorkspace(snapshot.workspace.id)).includes(credential.bearerToken), false);
  db.close();
});
