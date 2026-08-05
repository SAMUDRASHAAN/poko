/**
 * Minimal ambient types for Node's built-in SQLite.
 *
 * The repo pins `@types/node@^20`, which predates `node:sqlite`. Bumping it is a
 * dependency change and needs an ADR, so this declares only the slice
 * `node-driver.ts` actually uses. Delete it if `@types/node` is ever raised past
 * v22, at which point the real types ship with it.
 */
declare module 'node:sqlite' {
  export class DatabaseSync {
    constructor(location: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }

  export interface StatementSync {
    run(...params: unknown[]): { changes: number; lastInsertRowid: number };
    all(...params: unknown[]): Record<string, string | number | null>[];
    get(...params: unknown[]): Record<string, string | number | null> | undefined;
  }
}
