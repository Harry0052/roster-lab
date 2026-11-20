import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { openDatabase } from "../src/server/db.ts";
import { SecretStore } from "../src/server/secrets.ts";
import { RosterStore } from "../src/server/store.ts";
import { containerFile, dockerAvailable, stopContainer } from "../src/server/workspace-runner.ts";

test("two projects run in two container desktops", { timeout: 180000 }, async () => {
  assert.equal(dockerAvailable(), true);
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "roster-containers-"));
  const db = openDatabase(path.join(home, "roster.sqlite"));
  const store = new RosterStore({
    db,
    secrets: SecretStore.open(home),
    now: () => new Date("2026-11-20T13:00:00.000Z"),
    allowLoopbackCallbacks: false,
    fetchImpl: fetch,
    dataDir: home,
  });
  const names: string[] = [];
  try {
    const workspace = store.createWorkspace("Container company");
    const bot = store.createMainBot(workspace.id, "Main bot (Simulated)", "simulated");
    const alpha = store.createProject(workspace.id, "Alpha desk", "First container", { goal: "Show Alpha", mainBotId: bot.id });
    const beta = store.createProject(workspace.id, "Beta desk", "Second container", { goal: "Show Beta", mainBotId: bot.id });
    const alphaTask = store.delegate(bot.id, alpha.id, "Alpha task", "Only Alpha");
    const betaTask = store.delegate(bot.id, beta.id, "Beta task", "Only Beta");
    await store.runDelegated(alpha.id, alphaTask.id, "container");
    await store.runDelegated(beta.id, betaTask.id, "container");
    const alphaProject = store.project(alpha.id);
    const betaProject = store.project(beta.id);
    assert.equal(alphaProject.workspaceKind, "container");
    assert.equal(betaProject.workspaceKind, "container");
    assert.equal(alphaProject.workspaceLabel, "container desktop");
    assert.notEqual(alphaProject.workspaceEndpoint, betaProject.workspaceEndpoint);
    assert.match(alphaProject.workspaceEndpoint ?? "", /vnc\.html/);
    const alphaName = `rosterlab-${alpha.id.replaceAll("_", "-")}`;
    const betaName = `rosterlab-${beta.id.replaceAll("_", "-")}`;
    names.push(alphaName, betaName);
    fs.writeFileSync(path.join(home, "project-files", alpha.id, "only-alpha.txt"), "only-alpha");
    assert.equal(containerFile(alphaName, "/work/only-alpha.txt"), "only-alpha");
    assert.equal(containerFile(betaName, "/work/only-alpha.txt"), null);
    assert.match(containerFile(alphaName, "/work/note.txt") ?? "", /Alpha desk/);
    assert.match(containerFile(betaName, "/work/note.txt") ?? "", /Beta desk/);
    assert.equal(store.task(alphaTask.id).resultLabel, "container");
    assert.equal(store.task(betaTask.id).resultLabel, "container");
    assert.equal(fs.statSync(store.framePath(alpha.id) ?? "").size > 1000, true);
    assert.equal(fs.statSync(store.framePath(beta.id) ?? "").size > 1000, true);
  } finally {
    for (const name of names) stopContainer(name);
    db.close();
  }
});
