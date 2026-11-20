import http from "node:http";
import path from "node:path";
import { openDatabase } from "./db.ts";
import { createHandler } from "./http.ts";
import { dataDir, dbPath, ensureDataDir } from "./paths.ts";
import { SecretStore } from "./secrets.ts";
import { RosterStore } from "./store.ts";

const host = process.env.ROSTER_LAB_HOST ?? "127.0.0.1";
if (host !== "127.0.0.1" && host !== "localhost" && process.env.ROSTER_LAB_EXPOSE !== "1") {
  console.error("Refusing to listen beyond localhost. Set ROSTER_LAB_EXPOSE=1 only when you intend to publish this process.");
  process.exit(1);
}

const port = Number(process.env.ROSTER_LAB_PORT ?? 4317);
const home = dataDir();
ensureDataDir(home);
const database = openDatabase(dbPath(home));
const store = new RosterStore({
  db: database,
  secrets: SecretStore.open(home),
  now: () => new Date(),
  allowLoopbackCallbacks: process.env.ROSTER_LAB_ALLOW_LOOPBACK_CALLBACKS === "1",
  fetchImpl: fetch,
});
const distDir = process.env.ROSTER_LAB_SERVE_DIST === "1" ? path.resolve("dist") : null;
const server = http.createServer(
  createHandler({
    store,
    port,
    distDir,
    dataDir: home,
    allowLoopbackCallbacks: process.env.ROSTER_LAB_ALLOW_LOOPBACK_CALLBACKS === "1",
  }),
);

server.listen(port, host, () => {
  console.log(`Roster Lab API on http://${host}:${port}`);
  if (distDir) console.log(`Interface on http://${host}:${port}`);
  else console.log("Interface dev server is separate: http://127.0.0.1:4318");
  console.log(`Data directory: ${home}`);
});
