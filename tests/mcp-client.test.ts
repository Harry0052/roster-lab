import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { openDatabase } from "../src/server/db.ts";
import { SecretStore } from "../src/server/secrets.ts";
import { RosterStore } from "../src/server/store.ts";

test("an MCP client can talk to the stdio server", { timeout: 30000 }, async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "roster-mcp-"));
  fs.mkdirSync(home, { recursive: true });
  const db = openDatabase(path.join(home, "roster.sqlite"));
  const store = new RosterStore({
    db,
    secrets: SecretStore.open(home),
    now: () => new Date("2026-11-20T14:00:00.000Z"),
    allowLoopbackCallbacks: false,
    fetchImpl: fetch,
    dataDir: home,
  });
  const workspace = store.createWorkspace("MCP company");
  const bot = store.createMainBot(workspace.id, "Main bot (Simulated)", "simulated");
  store.createProject(workspace.id, "Software Engineer", "MCP project", { goal: "Be listed", mainBotId: bot.id });
  const credential = store.prepareMainCredential(bot.id);
  db.close();

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--experimental-sqlite", "--import", "tsx", path.resolve("scripts/mcp-stdio.ts")],
    env: {
      ...process.env,
      ROSTER_LAB_HOME: home,
      ROSTER_LAB_TOKEN: credential.bearerToken,
    },
    stderr: "inherit",
  });
  const client = new Client({ name: "roster-lab-test", version: "0.0.0" });
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    const names = tools.tools.map((tool) => tool.name);
    assert.equal(names.includes("list_projects"), true);
    assert.equal(names.includes("delegate_task"), true);
    assert.equal(names.includes("open_workspace"), true);
    assert.equal(names.includes("get_task_status"), true);
    const listed = await client.callTool({ name: "list_projects", arguments: {} });
    const text = JSON.stringify(listed);
    assert.match(text, /Software Engineer/);
    assert.equal(text.includes(credential.bearerToken), false);
  } finally {
    await client.close();
  }
});
