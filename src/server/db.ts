import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const TABLES = `
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS players (
  id             INTEGER PRIMARY KEY,
  token_hash     TEXT    NOT NULL UNIQUE,
  username       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  rolls          INTEGER NOT NULL DEFAULT 0,
  last_roll      TEXT,
  badge_count    INTEGER NOT NULL DEFAULT 0,
  badge_count_at INTEGER NOT NULL DEFAULT 0,
  best_score     INTEGER NOT NULL DEFAULT 0,
  best_roll      TEXT,
  best_badges    TEXT,
  best_at        INTEGER,
  created_at     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS discoveries (
  player_id     INTEGER NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  badge_id      TEXT    NOT NULL,
  discovered_at INTEGER NOT NULL,
  roll          TEXT    NOT NULL,
  roll_number   INTEGER NOT NULL,
  PRIMARY KEY (player_id, badge_id)
) WITHOUT ROWID;
`;

const INDEXES = `
CREATE INDEX IF NOT EXISTS players_by_badges    ON players (badge_count DESC, badge_count_at ASC);
CREATE INDEX IF NOT EXISTS players_by_best      ON players (best_score DESC, best_at ASC);
CREATE INDEX IF NOT EXISTS discoveries_by_badge ON discoveries (badge_id);
`;

export type Database = DatabaseSync;

/** Opens (and if needed creates or upgrades) the game database. Pass ":memory:" for tests. */
export function openDatabase(path: string): Database {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec(TABLES);
  migrate(db);
  db.exec(INDEXES);
  return db;
}

/**
 * Saves from before per-roll scoring kept a running XP total. XP now belongs
 * to each roll, so that column goes and a badge count (for the collection
 * leaderboard) takes its place. Discoveries and best rolls are kept as they are.
 */
function migrate(db: Database): void {
  const columns = (db.prepare('PRAGMA table_info(players)').all() as Array<{ name: string }>).map((c) => c.name);
  if (!columns.includes('xp')) return;
  transaction(db, () => {
    db.exec('DROP INDEX IF EXISTS players_by_xp');
    db.exec('ALTER TABLE players ADD COLUMN badge_count INTEGER NOT NULL DEFAULT 0');
    db.exec('ALTER TABLE players ADD COLUMN badge_count_at INTEGER NOT NULL DEFAULT 0');
    db.exec(`UPDATE players SET
      badge_count = (SELECT COUNT(*) FROM discoveries d WHERE d.player_id = players.id),
      badge_count_at = COALESCE((SELECT MAX(discovered_at) FROM discoveries d WHERE d.player_id = players.id), created_at)`);
    db.exec('ALTER TABLE players DROP COLUMN xp');
    db.exec('ALTER TABLE players DROP COLUMN xp_updated_at');
  });
}

export function transaction<T>(db: Database, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function getMeta(db: Database, key: string): string | null {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setMeta(db: Database, key: string, value: string): void {
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value').run(key, value);
}
