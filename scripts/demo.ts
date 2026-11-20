import http from "node:http";
import { openDatabase } from "../src/server/db.ts";
import { createHandler } from "../src/server/http.ts";
import { dataDir, dbPath, ensureDataDir } from "../src/server/paths.ts";
import { SecretStore } from "../src/server/secrets.ts";
import { RosterStore } from "../src/server/store.ts";

const home = dataDir();
ensureDataDir(home);
const database = openDatabase(dbPath(home));
const store = new RosterStore({
  db: database,
  secrets: SecretStore.open(home),
  now: () => new Date(),
  allowLoopbackCallbacks: false,
  fetchImpl: fetch,
  dataDir: home,
});
const port = Number(process.env.ROSTER_LAB_PORT ?? 4317);
const server = http.createServer(createHandler({ store, port, dataDir: home, distDir: null }));

server.listen(port, "127.0.0.1", async () => {
  console.log(`Roster Lab API http://127.0.0.1:${port}`);
  try {
    const snapshot = await store.createMainBotDemo();
    const project = snapshot.projects.find((item) => item.name === "Software Engineer");
    console.log(`Company: ${snapshot.workspace.name}`);
    console.log(`Main bot: ${snapshot.mainBots[0]?.displayName} (simulated)`);
    console.log(`Project: ${project?.name}`);
    console.log(`Workspace label: ${project?.workspaceLabel}`);
    console.log(`Open the interface with npm run dev, then choose this company if it is not already showing.`);
    console.log(`Frame: http://127.0.0.1:${port}${project?.workspaceEndpoint ?? ""}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
});
