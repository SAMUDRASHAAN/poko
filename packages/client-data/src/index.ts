/**
 * `@poko/client-data` — SQLite schema, repositories and the sync outbox.
 *
 * SQLite on the device is the source of truth; the server is a sync target
 * [INV-9]. Nothing here performs network I/O: the app must be fully playable with
 * the network permanently off [INV-8].
 *
 * The concrete SQLite driver is a port, not a dependency — see `driver.ts`.
 */
export { one, type SqlRow, type SqlValue, type SqliteDriver } from './driver.js';
export { createNodeSqliteDriver } from './node-driver.js';
export { MIGRATIONS, currentVersion, migrate, type Migration } from './migrations.js';
export {
  enqueue,
  markSynced,
  pending,
  pruneSynced,
  type NewOutboxEntry,
  type OutboxEntry,
} from './outbox.js';
export {
  createChildProfile,
  eraseConsent,
  getChildProfile,
  getConsent,
  getProgress,
  getSetting,
  listMastery,
  loadLevelState,
  mergeProgress,
  appendConsent,
  revokeConsent,
  putSetting,
  saveLevelState,
  upsertMastery,
  type ChildProfile,
  type Clock,
  type ConsentRecord,
  type MasteryRow,
  type ProgressRow,
} from './repositories.js';
