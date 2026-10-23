import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import type {
  AwardedBadge,
  BadgeStatsResponse,
  BadgeView,
  BestLeaderboardEntry,
  BestRoll,
  CatalogResponse,
  LeaderboardResponse,
  PlayerSummary,
  ProfileResponse,
  RegisterResponse,
  CollectionLeaderboardEntry,
  RollResponse,
} from '../shared/api';
import type { LocalTime } from '../shared/badges/types';
import { compareBadgeQuality, getRegistry, type BadgeRegistry, type CatalogBadge } from '../shared/badges/registry';
import { rarityForXp } from '../shared/progression';
import type { RandomSource } from '../shared/rng';
import { formatRoll, parseRoll, rollCells, rollNumber, type Roll } from '../shared/roll';
import { rollXp, standoutBadges } from '../shared/scoring';
import { getMeta, setMeta, transaction, type Database } from './db';
import { generateUsername, usernameProblem } from './names';

export class GameError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryAfterMs?: number,
  ) {
    super(message);
  }
}

export const cryptoRandom: RandomSource = { int: (maxExclusive) => randomInt(maxExclusive) };

interface PlayerRow {
  id: number;
  username: string;
  rolls: number;
  last_roll: string | null;
  badge_count: number;
  badge_count_at: number;
  /** XP of the player's best roll. */
  best_score: number;
  best_roll: string | null;
  best_badges: string | null;
  best_at: number | null;
}

export interface GameOptions {
  db: Database;
  registry?: BadgeRegistry;
  rng?: RandomSource;
  now?: () => number;
}

const PLAYER_COLUMNS =
  'id, username, rolls, last_roll, badge_count, badge_count_at, best_score, best_roll, best_badges, best_at';

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

/** Wall-clock time in the player's zone. `tzOffsetMinutes` follows Date#getTimezoneOffset (UTC − local). */
export function localTime(nowMs: number, tzOffsetMinutes: number): LocalTime {
  const d = new Date(nowMs - tzOffsetMinutes * 60_000);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
  };
}

/**
 * All game rules that touch persistence. Rolls happen here, on the server,
 * so the leaderboards only ever contain numbers this code actually rolled.
 */
export class GameService {
  readonly registry: BadgeRegistry;
  private readonly db: Database;
  private readonly rng: RandomSource;
  private readonly now: () => number;
  private readonly catalogVersion: string;
  private catalogCache: CatalogResponse | null = null;
  private statsCache: { at: number; value: BadgeStatsResponse } | null = null;

  constructor(options: GameOptions) {
    this.db = options.db;
    this.registry = options.registry ?? getRegistry();
    this.rng = options.rng ?? cryptoRandom;
    this.now = options.now ?? Date.now;
    this.catalogVersion = createHash('sha256')
      .update(this.registry.badges.map((b) => `${b.id}:${b.xp}`).join('|'))
      .digest('hex')
      .slice(0, 16);
    this.syncCatalogVersion();
  }

  // ── Accounts ────────────────────────────────────────────────────────────

  register(requestedName?: string): RegisterResponse {
    let username = requestedName?.trim();
    if (username) {
      const problem = usernameProblem(username);
      if (problem) throw new GameError(400, 'bad_username', problem);
      if (this.usernameTaken(username)) throw new GameError(409, 'username_taken', 'That username is taken.');
    } else {
      do username = generateUsername();
      while (this.usernameTaken(username));
    }
    const token = randomBytes(32).toString('base64url');
    const t = this.now();
    const result = this.db
      .prepare('INSERT INTO players (token_hash, username, badge_count_at, created_at) VALUES (?, ?, ?, ?)')
      .run(hashToken(token), username, t, t);
    return { token, player: this.summary(this.playerById(Number(result.lastInsertRowid))!) };
  }

  authenticate(token: string | undefined): number | null {
    if (!token) return null;
    const row = this.db.prepare('SELECT id FROM players WHERE token_hash = ?').get(hashToken(token)) as { id: number } | undefined;
    return row?.id ?? null;
  }

  rename(playerId: number, username: string): PlayerSummary {
    const name = username.trim();
    const problem = usernameProblem(name);
    if (problem) throw new GameError(400, 'bad_username', problem);
    const current = this.requirePlayer(playerId);
    if (current.username.toLowerCase() !== name.toLowerCase() && this.usernameTaken(name)) {
      throw new GameError(409, 'username_taken', 'That username is taken.');
    }
    this.db.prepare('UPDATE players SET username = ? WHERE id = ?').run(name, playerId);
    return this.summary(this.requirePlayer(playerId));
  }

  // ── Rolling ─────────────────────────────────────────────────────────────

  roll(playerId: number, tzOffsetMinutes = 0): RollResponse {
    const before = this.requirePlayer(playerId);
    const offset = Number.isFinite(tzOffsetMinutes) ? Math.max(-840, Math.min(840, Math.round(tzOffsetMinutes))) : 0;
    const t = this.now();
    const roll = rollNumber(this.rng);
    const text = formatRoll(roll);
    const number = before.rolls + 1;
    const ids = this.registry.detectorInstance.detect(roll, {
      previous: before.last_roll ? parseRoll(before.last_roll) : null,
      rollNumber: number,
      local: localTime(t, offset),
    });
    const earned = ids.map((id) => this.registry.get(id)!).sort(compareBadgeQuality);
    // The roll is scored on its own: every badge it earned counts, found before or not.
    const xp = rollXp(earned);

    const { fresh, bestImproved } = transaction(this.db, () => {
      const owned = this.ownedAmong(playerId, ids);
      const fresh = earned.filter((b) => !owned.has(b.id));
      const insert = this.db.prepare(
        'INSERT INTO discoveries (player_id, badge_id, discovered_at, roll, roll_number) VALUES (?, ?, ?, ?, ?)',
      );
      for (const b of fresh) insert.run(playerId, b.id, t, text, number);
      const bestImproved = xp > before.best_score;
      const improved = bestImproved ? 1 : 0;
      this.db
        .prepare(
          `UPDATE players SET
             rolls = rolls + 1, last_roll = ?,
             badge_count = badge_count + ?, badge_count_at = CASE WHEN ? > 0 THEN ? ELSE badge_count_at END,
             best_score  = CASE WHEN ? THEN ? ELSE best_score END,
             best_roll   = CASE WHEN ? THEN ? ELSE best_roll END,
             best_badges = CASE WHEN ? THEN ? ELSE best_badges END,
             best_at     = CASE WHEN ? THEN ? ELSE best_at END
           WHERE id = ?`,
        )
        .run(
          text,
          fresh.length, fresh.length, t,
          improved, xp,
          improved, text,
          improved, JSON.stringify(ids),
          improved, t,
          playerId,
        );
      return { fresh: new Set(fresh.map((b) => b.id)), bestImproved };
    });

    const after = this.requirePlayer(playerId);
    const badges: AwardedBadge[] = earned.map((b) => ({ ...this.view(b, true), isNew: fresh.has(b.id) }));
    return {
      id: randomUUID(),
      rollNumber: number,
      roll: this.rollView(roll),
      badges,
      xp,
      rarity: rarityForXp(xp).id,
      bestImproved,
      player: this.summary(after),
    };
  }

  // ── Reads ───────────────────────────────────────────────────────────────

  profile(playerId: number): ProfileResponse {
    const player = this.requirePlayer(playerId);
    const rows = this.db
      .prepare('SELECT badge_id, discovered_at, roll, roll_number FROM discoveries WHERE player_id = ? ORDER BY discovered_at, badge_id')
      .all(playerId) as Array<{ badge_id: string; discovered_at: number; roll: string; roll_number: number }>;
    const live = rows.filter((r) => this.registry.get(r.badge_id));
    return {
      player: this.summary(player),
      discoveries: live.map((r) => ({ badgeId: r.badge_id, at: r.discovered_at, roll: r.roll, rollNumber: r.roll_number })),
      revealed: live
        .map((r) => this.registry.get(r.badge_id)!)
        .filter((b) => b.hidden)
        .map((b) => this.view(b, true)),
      best: this.bestRoll(player),
    };
  }

  catalog(): CatalogResponse {
    this.catalogCache ??= {
      version: this.catalogVersion,
      badges: this.registry.badges.map((b) => this.view(b, !b.hidden)),
    };
    return this.catalogCache;
  }

  /** Most distinct badges found; ties go to whoever got there first. */
  collectionLeaderboard(limit: number, playerId: number | null): LeaderboardResponse<CollectionLeaderboardEntry> {
    const rows = this.db
      .prepare('SELECT id, username, badge_count FROM players WHERE rolls > 0 ORDER BY badge_count DESC, badge_count_at ASC, id ASC LIMIT ?')
      .all(limit) as Array<{ id: number; username: string; badge_count: number }>;
    const entry = (r: { id: number; username: string; badge_count: number }, rank: number): CollectionLeaderboardEntry => ({
      rank,
      playerId: r.id,
      username: r.username,
      badges: r.badge_count,
    });
    const entries = rows.map((r, i) => entry(r, i + 1));
    let you: CollectionLeaderboardEntry | null = entries.find((e) => e.playerId === playerId) ?? null;
    if (!you && playerId !== null) {
      const me = this.playerById(playerId);
      if (me && me.rolls > 0) {
        const { ahead } = this.db
          .prepare(
            `SELECT COUNT(*) AS ahead FROM players WHERE rolls > 0 AND (
               badge_count > ? OR (badge_count = ? AND badge_count_at < ?) OR (badge_count = ? AND badge_count_at = ? AND id < ?))`,
          )
          .get(me.badge_count, me.badge_count, me.badge_count_at, me.badge_count, me.badge_count_at, me.id) as { ahead: number };
        you = entry(me, ahead + 1);
      }
    }
    return { entries, totalPlayers: this.activePlayers(), you };
  }

  /** Each player's best single roll, by its XP. */
  bestLeaderboard(limit: number, playerId: number | null): LeaderboardResponse<BestLeaderboardEntry> {
    const rows = this.db
      .prepare(
        `SELECT ${PLAYER_COLUMNS}
         FROM players WHERE best_score > 0 ORDER BY best_score DESC, best_at ASC, id ASC LIMIT ?`,
      )
      .all(limit) as unknown as PlayerRow[];
    const entry = (r: PlayerRow, rank: number): BestLeaderboardEntry => ({
      rank,
      playerId: r.id,
      username: r.username,
      ...this.bestRoll(r)!,
    });
    const entries = rows.map((r, i) => entry(r, i + 1));
    let you: BestLeaderboardEntry | null = entries.find((e) => e.playerId === playerId) ?? null;
    if (!you && playerId !== null) {
      const me = this.playerById(playerId);
      if (me && me.best_score > 0) {
        const { ahead } = this.db
          .prepare(
            `SELECT COUNT(*) AS ahead FROM players WHERE best_score > ? OR (best_score = ? AND best_at < ?)
               OR (best_score = ? AND best_at = ? AND id < ?)`,
          )
          .get(me.best_score, me.best_score, me.best_at, me.best_score, me.best_at, me.id) as { ahead: number };
        you = entry(me, ahead + 1);
      }
    }
    return { entries, totalPlayers: this.activePlayers(), you };
  }

  badgeStats(): BadgeStatsResponse {
    const t = this.now();
    if (this.statsCache && t - this.statsCache.at < 30_000) return this.statsCache.value;
    const rows = this.db.prepare('SELECT badge_id, COUNT(*) AS n FROM discoveries GROUP BY badge_id').all() as Array<{
      badge_id: string;
      n: number;
    }>;
    const value = { players: this.activePlayers(), counts: Object.fromEntries(rows.map((r) => [r.badge_id, r.n])) };
    this.statsCache = { at: t, value };
    return value;
  }

  // ── Internals ───────────────────────────────────────────────────────────

  /**
   * A best roll's XP is the sum of its badges' current values. When badge XP
   * changes between releases, every stored best roll is rescored from its
   * badges and badge counts are recounted, so the leaderboards stay consistent.
   */
  private syncCatalogVersion(): void {
    if (getMeta(this.db, 'catalog_version') === this.catalogVersion) return;
    transaction(this.db, () => {
      const best = this.db.prepare('SELECT id, best_badges FROM players WHERE best_badges IS NOT NULL').all() as Array<{
        id: number;
        best_badges: string;
      }>;
      const update = this.db.prepare('UPDATE players SET best_score = ? WHERE id = ?');
      for (const row of best) {
        const badges = (JSON.parse(row.best_badges) as string[]).flatMap((id) => this.registry.get(id) ?? []);
        update.run(rollXp(badges), row.id);
      }
      const known = new Set(this.registry.badges.map((b) => b.id));
      const counts = this.db.prepare('SELECT player_id, badge_id FROM discoveries').all() as Array<{ player_id: number; badge_id: string }>;
      const perPlayer = new Map<number, number>();
      for (const c of counts) if (known.has(c.badge_id)) perPlayer.set(c.player_id, (perPlayer.get(c.player_id) ?? 0) + 1);
      this.db.exec('UPDATE players SET badge_count = 0');
      const setCount = this.db.prepare('UPDATE players SET badge_count = ? WHERE id = ?');
      for (const [id, n] of perPlayer) setCount.run(n, id);
      setMeta(this.db, 'catalog_version', this.catalogVersion);
    });
  }

  private ownedAmong(playerId: number, ids: string[]): Set<string> {
    if (ids.length === 0) return new Set();
    const rows = this.db
      .prepare(`SELECT badge_id FROM discoveries WHERE player_id = ? AND badge_id IN (${ids.map(() => '?').join(',')})`)
      .all(playerId, ...ids) as Array<{ badge_id: string }>;
    return new Set(rows.map((r) => r.badge_id));
  }

  private usernameTaken(name: string): boolean {
    return this.db.prepare('SELECT 1 FROM players WHERE username = ?').get(name) !== undefined;
  }

  private playerById(id: number): PlayerRow | undefined {
    return this.db.prepare(`SELECT ${PLAYER_COLUMNS} FROM players WHERE id = ?`).get(id) as PlayerRow | undefined;
  }

  private requirePlayer(id: number): PlayerRow {
    const row = this.playerById(id);
    if (!row) throw new GameError(401, 'unknown_player', 'Player not found.');
    return row;
  }

  private activePlayers(): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM players WHERE rolls > 0').get() as { n: number }).n;
  }

  private summary(row: PlayerRow): PlayerSummary {
    return {
      id: row.id,
      username: row.username,
      rolls: row.rolls,
      uniqueBadges: row.badge_count,
      bestXp: row.best_score,
      bestRarity: rarityForXp(row.best_score).id,
    };
  }

  private bestRoll(row: PlayerRow): BestRoll | null {
    if (!row.best_roll || !row.best_badges || row.best_at === null) return null;
    const badges = (JSON.parse(row.best_badges) as string[]).flatMap((id) => this.registry.get(id) ?? []);
    return {
      roll: row.best_roll,
      xp: row.best_score,
      rarity: rarityForXp(row.best_score).id,
      at: row.best_at,
      badges: standoutBadges(badges).map((b) => ({ id: b.id, name: b.name, tier: b.tier, xp: b.xp })),
    };
  }

  private rollView(roll: Roll): RollResponse['roll'] {
    return { text: formatRoll(roll), digits: roll.digits, skips: roll.skips, seven: roll.seven, cells: rollCells(roll) };
  }

  private view(b: CatalogBadge, revealed: boolean): BadgeView {
    if (revealed) return { ...b, revealed: true };
    return {
      id: b.id,
      name: '???',
      description: 'A secret badge. Keep rolling.',
      category: b.category,
      family: b.family,
      hidden: true,
      revealed: false,
      probability: b.probability,
      xp: b.xp,
      tier: b.tier,
    };
  }
}
