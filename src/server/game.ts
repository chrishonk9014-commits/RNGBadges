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
  RollResponse,
  XpLeaderboardEntry,
} from '../shared/api';
import type { LocalTime } from '../shared/badges/types';
import { compareBadgeQuality, getRegistry, type BadgeRegistry, type CatalogBadge } from '../shared/badges/registry';
import { rarityForXp } from '../shared/progression';
import type { RandomSource } from '../shared/rng';
import { formatRoll, parseRoll, rollCells, rollNumber, type Roll } from '../shared/roll';
import { rollScore, standoutBadges } from '../shared/scoring';
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
  xp: number;
  xp_updated_at: number;
  rolls: number;
  last_roll: string | null;
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
      .prepare('INSERT INTO players (token_hash, username, xp_updated_at, created_at) VALUES (?, ?, ?, ?)')
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
    const score = rollScore(earned);

    const { fresh, bestImproved } = transaction(this.db, () => {
      const owned = this.ownedAmong(playerId, ids);
      const fresh = earned.filter((b) => !owned.has(b.id));
      const insert = this.db.prepare(
        'INSERT INTO discoveries (player_id, badge_id, discovered_at, roll, roll_number) VALUES (?, ?, ?, ?, ?)',
      );
      for (const b of fresh) insert.run(playerId, b.id, t, text, number);
      const gained = fresh.reduce((sum, b) => sum + b.xp, 0);
      const bestImproved = score > before.best_score;
      this.db
        .prepare(
          `UPDATE players SET
             xp = xp + ?, xp_updated_at = CASE WHEN ? > 0 THEN ? ELSE xp_updated_at END,
             rolls = rolls + 1, last_roll = ?,
             best_score = CASE WHEN ? THEN ? ELSE best_score END,
             best_roll  = CASE WHEN ? THEN ? ELSE best_roll END,
             best_badges = CASE WHEN ? THEN ? ELSE best_badges END,
             best_at    = CASE WHEN ? THEN ? ELSE best_at END
           WHERE id = ?`,
        )
        .run(
          gained, gained, t,
          text,
          bestImproved ? 1 : 0, score,
          bestImproved ? 1 : 0, text,
          bestImproved ? 1 : 0, JSON.stringify(ids),
          bestImproved ? 1 : 0, t,
          playerId,
        );
      return { fresh: new Set(fresh.map((b) => b.id)), bestImproved };
    });

    const after = this.requirePlayer(playerId);
    const from = rarityForXp(before.xp).id;
    const to = rarityForXp(after.xp).id;
    const badges: AwardedBadge[] = earned.map((b) => ({ ...this.view(b, true), isNew: fresh.has(b.id) }));
    return {
      id: randomUUID(),
      rollNumber: number,
      roll: this.rollView(roll),
      badges,
      xpGained: after.xp - before.xp,
      score,
      bestImproved,
      rankUp: from === to ? null : { from, to },
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
      totalXp: this.registry.totalXp,
      badges: this.registry.badges.map((b) => this.view(b, !b.hidden)),
    };
    return this.catalogCache;
  }

  xpLeaderboard(limit: number, playerId: number | null): LeaderboardResponse<XpLeaderboardEntry> {
    const rows = this.db
      .prepare('SELECT id, username, xp FROM players WHERE rolls > 0 ORDER BY xp DESC, xp_updated_at ASC, id ASC LIMIT ?')
      .all(limit) as Array<{ id: number; username: string; xp: number }>;
    const entry = (r: { id: number; username: string; xp: number }, rank: number): XpLeaderboardEntry => ({
      rank,
      playerId: r.id,
      username: r.username,
      xp: r.xp,
      rarity: rarityForXp(r.xp).id,
    });
    const entries = rows.map((r, i) => entry(r, i + 1));
    let you: XpLeaderboardEntry | null = entries.find((e) => e.playerId === playerId) ?? null;
    if (!you && playerId !== null) {
      const me = this.playerById(playerId);
      if (me && me.rolls > 0) {
        const { ahead } = this.db
          .prepare(
            `SELECT COUNT(*) AS ahead FROM players WHERE rolls > 0 AND (
               xp > ? OR (xp = ? AND xp_updated_at < ?) OR (xp = ? AND xp_updated_at = ? AND id < ?))`,
          )
          .get(me.xp, me.xp, me.xp_updated_at, me.xp, me.xp_updated_at, me.id) as { ahead: number };
        you = entry(me, ahead + 1);
      }
    }
    return { entries, totalPlayers: this.activePlayers(), you };
  }

  bestLeaderboard(limit: number, playerId: number | null): LeaderboardResponse<BestLeaderboardEntry> {
    const rows = this.db
      .prepare(
        `SELECT id, username, xp, xp_updated_at, rolls, last_roll, best_score, best_roll, best_badges, best_at
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
   * XP is the sum of discovered badges' current values. When badge XP changes
   * between releases, every player's total and best-roll score are rebuilt
   * from their discoveries so the leaderboards stay consistent.
   */
  private syncCatalogVersion(): void {
    if (getMeta(this.db, 'catalog_version') === this.catalogVersion) return;
    transaction(this.db, () => {
      this.db.exec('CREATE TEMP TABLE IF NOT EXISTS badge_xp (id TEXT PRIMARY KEY, xp INTEGER NOT NULL)');
      this.db.exec('DELETE FROM badge_xp');
      const insert = this.db.prepare('INSERT INTO badge_xp (id, xp) VALUES (?, ?)');
      for (const b of this.registry.badges) insert.run(b.id, b.xp);
      this.db.exec(`UPDATE players SET xp = COALESCE(
        (SELECT SUM(x.xp) FROM discoveries d JOIN badge_xp x ON x.id = d.badge_id WHERE d.player_id = players.id), 0)`);
      const best = this.db.prepare('SELECT id, best_badges FROM players WHERE best_badges IS NOT NULL').all() as Array<{
        id: number;
        best_badges: string;
      }>;
      const update = this.db.prepare('UPDATE players SET best_score = ? WHERE id = ?');
      for (const row of best) {
        const badges = (JSON.parse(row.best_badges) as string[]).flatMap((id) => this.registry.get(id) ?? []);
        update.run(rollScore(badges), row.id);
      }
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
    return this.db
      .prepare(
        'SELECT id, username, xp, xp_updated_at, rolls, last_roll, best_score, best_roll, best_badges, best_at FROM players WHERE id = ?',
      )
      .get(id) as PlayerRow | undefined;
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
    const { n } = this.db.prepare('SELECT COUNT(*) AS n FROM discoveries WHERE player_id = ?').get(row.id) as { n: number };
    return { id: row.id, username: row.username, xp: row.xp, rarity: rarityForXp(row.xp).id, rolls: row.rolls, uniqueBadges: n };
  }

  private bestRoll(row: PlayerRow): BestRoll | null {
    if (!row.best_roll || !row.best_badges || row.best_at === null) return null;
    const badges = (JSON.parse(row.best_badges) as string[]).flatMap((id) => this.registry.get(id) ?? []);
    return {
      roll: row.best_roll,
      score: row.best_score,
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
