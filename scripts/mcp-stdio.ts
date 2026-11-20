import readline from "node:readline";
import { openDatabase } from "../src/server/db.ts";
import { handleMainMcp, handleMcp } from "../src/server/mcp.ts";
import { dataDir, dbPath, ensureDataDir } from "../src/server/paths.ts";
import { SecretStore } from "../src/server/secrets.ts";
import { RosterStore } from "../src/server/store.ts";

const home = dataDir();
ensureDataDir(home);
const store = new RosterStore({
  db: openDatabase(dbPath(home)),
  secrets: SecretStore.open(home),
  now: () => new Date(),
  allowLoopbackCallbacks: false,
  fetchImpl: fetch,
  dataDir: home,
});

const lines = readline.createInterface({ input: process.stdin });
lines.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  void onMessage(trimmed);
});

async function onMessage(body: string) {
  let message: { jsonrpc?: string; id?: unknown; method?: string; params?: Record<string, unknown> };
  try {
    message = JSON.parse(body) as typeof message;
  } catch {
    send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
    return;
  }
  if (typeof message.method === "string" && message.method.startsWith("notifications/")) return;
  const token = process.env.ROSTER_LAB_TOKEN ?? "";
  const actor = token ? store.actorByToken(token) : null;
  if (!actor) {
    send({ jsonrpc: "2.0", id: message.id ?? null, error: { code: -32001, message: "Roster Lab credential missing or revoked." } });
    return;
  }
  const response =
    actor.kind === "main"
      ? await handleMainMcp(store, actor.mainBotId, message)
      : await handleMcp(store, actor.employeeId, message, false, fetch);
  send(response);
}

function send(message: unknown) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

process.stderr.write("Roster Lab MCP stdio is listening. Tokens are not printed.\n");
