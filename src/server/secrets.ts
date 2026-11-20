import fs from "node:fs";
import { secretPath } from "./paths.ts";

type FileShape = { secrets: Record<string, { kind: string; value: string; createdAt: string }> };

export class SecretStore {
  constructor(private readonly file: string) {}

  static open(dir: string): SecretStore {
    return new SecretStore(secretPath(dir));
  }

  put(id: string, kind: string, value: string, createdAt: string): void {
    const data = this.read();
    data.secrets[id] = { kind, value, createdAt };
    this.write(data);
  }

  get(id: string): string | null {
    return this.read().secrets[id]?.value ?? null;
  }

  delete(id: string): void {
    const data = this.read();
    delete data.secrets[id];
    this.write(data);
  }

  private read(): FileShape {
    if (!fs.existsSync(this.file)) return { secrets: {} };
    const parsed = JSON.parse(fs.readFileSync(this.file, "utf8")) as FileShape;
    if (!parsed.secrets || typeof parsed.secrets !== "object") return { secrets: {} };
    return parsed;
  }

  private write(data: FileShape): void {
    const body = JSON.stringify(data);
    fs.writeFileSync(this.file, body, { mode: 0o600 });
    try {
      fs.chmodSync(this.file, 0o600);
    } catch {
      // Best effort. The write itself used mode 0600.
    }
  }
}

export function redact(value: string): string {
  return value
    .replace(/rlb_[a-f0-9]{16,}/gi, "[redacted-token]")
    .replace(/whsec_[A-Za-z0-9+/=_-]{8,}/g, "[redacted-secret]");
}
