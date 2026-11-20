declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }

  export class StatementSync {
    run(...params: Array<string | number | null | Uint8Array>): { changes: number; lastInsertRowid: number | bigint };
    get(...params: Array<string | number | null | Uint8Array>): Record<string, unknown> | undefined;
    all(...params: Array<string | number | null | Uint8Array>): Array<Record<string, unknown>>;
  }
}
