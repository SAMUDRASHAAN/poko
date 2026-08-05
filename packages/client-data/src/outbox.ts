/**
 * The sync outbox.
 *
 * `ARCHITECTURE.md` §8.2: every local write queues an outbox row carrying a uuid
 * and `updated_at`; on connectivity the batch is posted, "server applies
 * idempotently, last-write-wins on updated_at".
 *
 * The app is fully playable with the network permanently off [INV-8], so nothing
 * here performs I/O or knows that a network exists. It is a durable queue, and
 * the transport is somebody else's job (`apps/mobile/src/services/sync.ts`).
 */
import { one, type SqliteDriver } from './driver.js';

export type OutboxEntry = {
  readonly uuid: string;
  readonly entity: string;
  readonly entityId: string;
  readonly payload: string;
  readonly updatedAt: string;
  readonly syncedAt: string | null;
};

export type NewOutboxEntry = {
  readonly entity: string;
  readonly entityId: string;
  readonly payload: string;
  readonly updatedAt: string;
  /** Supplied only by tests and by replay; generated otherwise. */
  readonly uuid?: string;
};

/**
 * Deterministic uuid for an entity's pending write.
 *
 * One pending row per `(entity, entityId)`, so a child who plays fifty levels
 * offline syncs one current row per entity rather than fifty superseded ones. The
 * queue holds *state to converge on*, not an event log.
 */
function pendingUuid(entity: string, entityId: string): string {
  return `${entity}:${entityId}`;
}

/**
 * Queues a write, superseding any still-pending write for the same entity.
 *
 * Last-write-wins on `updated_at`: an out-of-order enqueue with an older
 * timestamp does not clobber a newer pending payload, which matters because the
 * device clock can move backwards.
 */
export function enqueue(driver: SqliteDriver, entry: NewOutboxEntry): void {
  const uuid = entry.uuid ?? pendingUuid(entry.entity, entry.entityId);

  driver.run(
    `INSERT INTO outbox (uuid, entity, entity_id, payload, updated_at, synced_at)
     VALUES (?, ?, ?, ?, ?, NULL)
     ON CONFLICT(uuid) DO UPDATE SET
       payload    = excluded.payload,
       updated_at = excluded.updated_at,
       synced_at  = NULL
     WHERE excluded.updated_at >= outbox.updated_at`,
    [uuid, entry.entity, entry.entityId, entry.payload, entry.updatedAt],
  );
}

/** Pending writes, oldest first, so a batch preserves causal order. */
export function pending(driver: SqliteDriver, limit = 100): OutboxEntry[] {
  return driver
    .all<{
      uuid: string;
      entity: string;
      entity_id: string;
      payload: string;
      updated_at: string;
      synced_at: string | null;
    }>(
      `SELECT * FROM outbox WHERE synced_at IS NULL
       ORDER BY updated_at ASC, uuid ASC LIMIT ?`,
      [limit],
    )
    .map((row) => ({
      uuid: row.uuid,
      entity: row.entity,
      entityId: row.entity_id,
      payload: row.payload,
      updatedAt: row.updated_at,
      syncedAt: row.synced_at,
    }));
}

/**
 * Marks entries acknowledged by the server.
 *
 * Only acknowledges rows whose `updated_at` still matches what was sent. If the
 * child changed something while the request was in flight, the row stays pending
 * and syncs again — an acknowledgement must never discard an unsent write.
 */
export function markSynced(
  driver: SqliteDriver,
  entries: readonly Pick<OutboxEntry, 'uuid' | 'updatedAt'>[],
  syncedAt: string,
): number {
  return driver.transaction(() => {
    let acknowledged = 0;
    for (const entry of entries) {
      const before = one<{ n: number }>(
        driver,
        'SELECT COUNT(*) AS n FROM outbox WHERE uuid = ? AND updated_at = ? AND synced_at IS NULL',
        [entry.uuid, entry.updatedAt],
      );
      if ((before?.n ?? 0) === 0) continue;

      driver.run('UPDATE outbox SET synced_at = ? WHERE uuid = ? AND updated_at = ?', [
        syncedAt,
        entry.uuid,
        entry.updatedAt,
      ]);
      acknowledged += 1;
    }
    return acknowledged;
  });
}

/** Drops acknowledged rows. Retention is the caller's policy, not the queue's. */
export function pruneSynced(driver: SqliteDriver, before: string): number {
  const rows = driver.all<{ n: number }>(
    'SELECT COUNT(*) AS n FROM outbox WHERE synced_at IS NOT NULL AND synced_at < ?',
    [before],
  );
  driver.run('DELETE FROM outbox WHERE synced_at IS NOT NULL AND synced_at < ?', [before]);
  return rows[0]?.n ?? 0;
}
