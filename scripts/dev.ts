import { spawn } from "node:child_process";

const server = spawn(process.execPath, ["--experimental-sqlite", "--import", "tsx", "src/server/index.ts"], {
  stdio: "inherit",
  env: process.env,
});
const web = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "4318", "--strictPort"], {
  stdio: "inherit",
  env: process.env,
});

function stop() {
  server.kill("SIGTERM");
  web.kill("SIGTERM");
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
server.on("exit", (code) => {
  web.kill("SIGTERM");
  process.exit(code ?? 0);
});
web.on("exit", (code) => {
  server.kill("SIGTERM");
  process.exit(code ?? 0);
});
