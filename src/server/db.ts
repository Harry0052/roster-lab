import { DatabaseSync } from "node:sqlite";

export function openDatabase(file: string): DatabaseSync {
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      approval_send INTEGER NOT NULL DEFAULT 1,
      approval_purchase INTEGER NOT NULL DEFAULT 1,
      approval_publish INTEGER NOT NULL DEFAULT 1,
      approval_delete INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      goal TEXT NOT NULL DEFAULT '',
      main_bot_id TEXT,
      workspace_kind TEXT NOT NULL DEFAULT 'unopened',
      workspace_label TEXT NOT NULL DEFAULT '',
      workspace_endpoint TEXT,
      frame_path TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS main_bots (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      provider_kind TEXT NOT NULL,
      note TEXT NOT NULL,
      secret_id TEXT,
      last_mcp_call_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role_title TEXT NOT NULL,
      responsibilities TEXT NOT NULL DEFAULT '',
      instructions TEXT NOT NULL DEFAULT '',
      provider_kind TEXT NOT NULL,
      allowed_projects TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL UNIQUE,
      provider TEXT NOT NULL,
      status TEXT NOT NULL,
      secret_id TEXT,
      last_mcp_call_at TEXT,
      revoked_at TEXT,
      note TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS computers (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL,
      label TEXT NOT NULL,
      isolation TEXT NOT NULL,
      evidence_json TEXT,
      last_confirmed_at TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      assignee_id TEXT,
      state TEXT NOT NULL,
      claim_owner_id TEXT,
      claim_expires_at TEXT,
      result_body TEXT,
      result_label TEXT,
      result_key TEXT,
      unknown_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS task_events (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      actor_type TEXT NOT NULL,
      actor_id TEXT,
      from_state TEXT,
      to_state TEXT NOT NULL,
      note TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      byte_size INTEGER NOT NULL,
      content_base64 TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      task_id TEXT,
      kind TEXT NOT NULL,
      summary TEXT NOT NULL,
      status TEXT NOT NULL,
      requested_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      decided_at TEXT,
      outcome TEXT
    );
    CREATE TABLE IF NOT EXISTS audit (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      action TEXT NOT NULL,
      detail TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      event_name TEXT NOT NULL,
      callback_url TEXT NOT NULL,
      secret_id TEXT NOT NULL,
      filter_json TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  ensureColumn(db, "projects", "goal", "goal TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "projects", "main_bot_id", "main_bot_id TEXT");
  ensureColumn(db, "projects", "workspace_kind", "workspace_kind TEXT NOT NULL DEFAULT 'unopened'");
  ensureColumn(db, "projects", "workspace_label", "workspace_label TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "projects", "workspace_endpoint", "workspace_endpoint TEXT");
  ensureColumn(db, "projects", "frame_path", "frame_path TEXT");
  return db;
}

function ensureColumn(db: DatabaseSync, table: string, name: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((column) => column.name === name)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
}

export function transaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const value = fn();
    db.exec("COMMIT");
    return value;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // The original error is the one to surface.
    }
    throw error;
  }
}
