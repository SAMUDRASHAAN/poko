/**
 * The SQLite port.
 *
 * `ARCHITECTURE.md` §5 allows `client-data` to depend on "a sqlite driver". It
 * does not say which, and it cannot yet: the concrete driver is a React Native
 * choice (`expo-sqlite`, `op-sqlite`), and ADR-0001 — which decides whether the
 * client is React Native at all — is still contingent on the Rive spike.
 *
 * So this package depends on a *port*, not a product. Every repository, the
 * migration runner and the outbox are written against this interface. Binding a
 * real driver is then a thin adapter, and adding that npm dependency gets its own
 * ADR as AGENTS.md requires. Nothing here needs rewriting if the decision moves.
 *
 * The API is synchronous because both realistic bindings are: `expo-sqlite` and
 * `node:sqlite` both expose synchronous statement execution.
 */

/** SQLite's storage classes, as they cross the port. */
export type SqlValue = string | number | null;

export type SqlRow = Record<string, SqlValue>;

export interface SqliteDriver {
  /** Runs one or more statements with no parameters. Used by migrations. */
  exec(sql: string): void;

  /** Runs a single parameterised statement. */
  run(sql: string, params?: readonly SqlValue[]): void;

  /** Runs a single parameterised query and returns every row. */
  all<Row extends SqlRow = SqlRow>(sql: string, params?: readonly SqlValue[]): Row[];

  /**
   * Runs `body` inside a transaction, committing on return and rolling back if it
   * throws. Implementations must not swallow the error.
   */
  transaction<Result>(body: () => Result): Result;

  close(): void;
}

/** Convenience for the common "at most one row" query. */
export function one<Row extends SqlRow>(
  driver: SqliteDriver,
  sql: string,
  params?: readonly SqlValue[],
): Row | null {
  const rows = driver.all<Row>(sql, params);
  return rows.length > 0 ? (rows[0] as Row) : null;
}
