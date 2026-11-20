import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function dataDir(home = process.env.ROSTER_LAB_HOME): string {
  if (home && home.trim()) return path.resolve(home);
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "roster-lab");
  }
  return path.join(os.homedir(), ".local", "share", "roster-lab");
}

export function ensureDataDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  try {
    fs.chmodSync(dir, 0o700);
  } catch {
    // Windows and some mounts ignore chmod. The file mode is still set on the secret file.
  }
}

export function dbPath(dir: string): string {
  return path.join(dir, "roster.sqlite");
}

export function secretPath(dir: string): string {
  return path.join(dir, "secrets.json");
}
