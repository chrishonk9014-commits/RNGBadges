/**
 * The full game running in the browser, for copies of the site with no game
 * server behind them (GitHub Pages). Same rules and the same responses as the
 * server's GameService, but the save lives in this browser's localStorage, so
 * there are no global leaderboards: the player sees their own top rolls.
 */
import type {
  AwardedBadge,
  BestRoll,
  CatalogResponse,
  PlayerSummary,
  ProfileResponse,
  RegisterResponse,
  RollResponse,
} from '../../shared/api';
import { compareBadgeQuality, getRegistry, type BadgeRegistry, type CatalogBadge } from '../../shared/badges/registry';
import { generateUsername, usernameProblem } from '../../shared/names';
import { rarityForXp } from '../../shared/progression';
import { webCryptoRandom, type RandomSource } from '../../shared/rng';
import { formatRoll, parseRoll, rollNumber } from '../../shared/roll';
import { rollXp, standoutBadges } from '../../shared/scoring';
import { clampTzOffset, localTime } from '../../shared/time';
import { badgeView, rollView } from '../../shared/views';

export const SAVE_KEY = 'rngbadges.save';
/** Stands in for the server's save code; the browser version has one player per browser. */
export const LOCAL_TOKEN = 'local';
const TOP_ROLLS = 10;

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface SavedRoll {
  roll: string;
  at: number;
  rollNumber: number;
  /** Every badge the roll earned. Its XP is recomputed from these, so it follows rebalances. */
  badges: string[];
}

export interface LocalSave {
  game: 'rng-badges';
  version: 1;
  username: string;
  createdAt: number;
  rolls: number;
  lastRoll: string | null;
  /** Badge id → [found at, roll text, roll number]. */
  found: Record<string, [number, string, number]>;
  /** This player's best rolls, best first. */
  top: SavedRoll[];
}

export interface TopRoll extends BestRoll {
  rollNumber: number;
}

export interface TopRollsResponse {
  rolls: TopRoll[];
}

export class LocalGameError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface LocalGameOptions {
  /** Where the save goes; null keeps it in memory only. */
  storage: KeyValueStore | null;
  registry?: BadgeRegistry;
  rng?: RandomSource;
  now?: () => number;
}

export class LocalGame {
  readonly registry: BadgeRegistry;
  /** False once the browser refuses to store the save: progress then lasts until the tab closes. */
  persistent: boolean;
  private readonly storage: KeyValueStore | null;
  private readonly rng: RandomSource;
  private readonly now: () => number;
  private memory: LocalSave | null = null;
  private catalogCache: CatalogResponse | null = null;

  constructor(options: LocalGameOptions) {
    this.storage = options.storage;
    this.persistent = options.storage !== null;
    this.registry = options.registry ?? getRegistry();
    this.rng = options.rng ?? webCryptoRandom;
    this.now = options.now ?? Date.now;
  }

  // ── Accounts ────────────────────────────────────────────────────────────

  register(): RegisterResponse {
    const save: LocalSave = {
      game: 'rng-badges',
      version: 1,
      username: generateUsername(this.rng),
      createdAt: this.now(),
      rolls: 0,
      lastRoll: null,
      found: {},
      top: [],
    };
    this.store(save);
    return { token: LOCAL_TOKEN, player: this.summary(save) };
  }

  rename(username: string): PlayerSummary {
    const name = username.trim();
    const problem = usernameProblem(name);
    if (problem) throw new LocalGameError(400, 'bad_username', problem);
    const save = this.require();
    save.username = name;
    this.store(save);
    return this.summary(save);
  }

  // ── Rolling ─────────────────────────────────────────────────────────────

  roll(tzOffsetMinutes = 0): RollResponse {
    // Read the save fresh, so two open tabs never undo each other's finds.
    const save = this.require();
    const t = this.now();
    const roll = rollNumber(this.rng);
    const text = formatRoll(roll);
    const number = save.rolls + 1;
    const ids = this.registry.detectorInstance.detect(roll, {
      previous: save.lastRoll ? parseRoll(save.lastRoll) : null,
      rollNumber: number,
      local: localTime(t, clampTzOffset(tzOffsetMinutes)),
    });
    const earned = ids.map((id) => this.registry.get(id)!).sort(compareBadgeQuality);
    // The roll is scored on its own: every badge it earned counts, found before or not.
    const xp = rollXp(earned);
    const bestImproved = xp > this.bestXp(save);

    const fresh = new Set<string>();
    for (const b of earned) {
      if (Object.hasOwn(save.found, b.id)) continue;
      save.found[b.id] = [t, text, number];
      fresh.add(b.id);
    }
    save.rolls = number;
    save.lastRoll = text;
    if (xp > 0) save.top = this.ranked([...save.top, { roll: text, at: t, rollNumber: number, badges: ids }]).slice(0, TOP_ROLLS);
    this.store(save);

    const badges: AwardedBadge[] = earned.map((b) => ({ ...badgeView(b, true), isNew: fresh.has(b.id) }));
    return {
      id: `local-${t.toString(36)}-${number}`,
      rollNumber: number,
      roll: rollView(roll),
      badges,
      xp,
      rarity: rarityForXp(xp).id,
      bestImproved,
      player: this.summary(save),
    };
  }

  // ── Reads ───────────────────────────────────────────────────────────────

  profile(): ProfileResponse {
    const save = this.require();
    const live = Object.entries(save.found)
      .filter(([id]) => this.registry.get(id))
      .sort(([a, x], [b, y]) => x[0] - y[0] || a.localeCompare(b));
    return {
      player: this.summary(save),
      discoveries: live.map(([badgeId, [at, roll, rollNumber]]) => ({ badgeId, at, roll, rollNumber })),
      revealed: live
        .map(([id]) => this.registry.get(id)!)
        .filter((b) => b.hidden)
        .map((b) => badgeView(b, true)),
      best: save.top.length ? this.bestRoll(this.ranked(save.top)[0]!) : null,
    };
  }

  catalog(): CatalogResponse {
    this.catalogCache ??= {
      version: 'local',
      badges: this.registry.badges.map((b) => badgeView(b, !b.hidden)),
    };
    return this.catalogCache;
  }

  topRolls(): TopRollsResponse {
    const save = this.require();
    return { rolls: this.ranked(save.top).slice(0, TOP_ROLLS).map((r) => ({ ...this.bestRoll(r), rollNumber: r.rollNumber })) };
  }

  // ── Save files ──────────────────────────────────────────────────────────

  exportSave(): string {
    return JSON.stringify(this.require());
  }

  /** Replaces this browser's progress with a save file's. */
  importSave(text: string): ProfileResponse {
    const save = parseSave(text);
    if (!save) throw new LocalGameError(400, 'bad_save', 'That file isn’t an RNG Badges save.');
    this.store(save);
    return this.profile();
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private require(): LocalSave {
    const save = this.load();
    if (!save) throw new LocalGameError(401, 'unknown_player', 'No save in this browser yet.');
    return save;
  }

  private load(): LocalSave | null {
    if (!this.storage) return this.memory;
    let raw: string | null;
    try {
      raw = this.storage.getItem(SAVE_KEY);
    } catch {
      return this.memory;
    }
    if (raw === null) return this.memory;
    const save = parseSave(raw);
    if (save) return (this.memory = save);
    // Unreadable: keep a copy instead of silently overwriting it with a new save.
    try {
      this.storage.setItem(`${SAVE_KEY}.unreadable`, raw);
      this.storage.removeItem(SAVE_KEY);
    } catch {
      // Nothing more to do; the next save replaces it.
    }
    return null;
  }

  private store(save: LocalSave): void {
    this.memory = save;
    if (!this.storage) return;
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(save));
      this.persistent = true;
    } catch {
      this.persistent = false;
    }
  }

  private badgesOf(r: SavedRoll): CatalogBadge[] {
    return r.badges.flatMap((id) => this.registry.get(id) ?? []);
  }

  /** Best first; ties go to the earlier roll. */
  private ranked(rolls: SavedRoll[]): SavedRoll[] {
    return rolls
      .map((r) => ({ r, xp: rollXp(this.badgesOf(r)) }))
      .filter((x) => x.xp > 0)
      .sort((a, b) => b.xp - a.xp || a.r.at - b.r.at)
      .map((x) => x.r);
  }

  private bestXp(save: LocalSave): number {
    const best = this.ranked(save.top)[0];
    return best ? rollXp(this.badgesOf(best)) : 0;
  }

  private bestRoll(r: SavedRoll): BestRoll {
    const badges = this.badgesOf(r);
    const xp = rollXp(badges);
    return {
      roll: r.roll,
      xp,
      rarity: rarityForXp(xp).id,
      at: r.at,
      badges: standoutBadges(badges).map((b) => ({ id: b.id, name: b.name, tier: b.tier, xp: b.xp })),
    };
  }

  private summary(save: LocalSave): PlayerSummary {
    const bestXp = this.bestXp(save);
    return {
      id: 1,
      username: save.username,
      rolls: save.rolls,
      uniqueBadges: Object.keys(save.found).filter((id) => this.registry.get(id)).length,
      bestXp,
      bestRarity: rarityForXp(bestXp).id,
    };
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isCount = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
const isTime = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isRoll = (v: unknown): v is string => typeof v === 'string' && parseRoll(v) !== null;

/** Reads a save, dropping anything malformed inside it. Null when it isn't a save at all. */
export function parseSave(text: string): LocalSave | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(raw) || raw.game !== 'rng-badges' || raw.version !== 1) return null;
  const { username, createdAt, rolls, lastRoll, found, top } = raw;
  if (typeof username !== 'string' || !username.trim() || !isTime(createdAt) || !isCount(rolls) || !isRecord(found) || !Array.isArray(top)) {
    return null;
  }
  const finds: LocalSave['found'] = {};
  for (const [id, f] of Object.entries(found)) {
    if (Array.isArray(f) && f.length === 3 && isTime(f[0]) && isRoll(f[1]) && isCount(f[2])) finds[id] = [f[0], f[1], f[2]];
  }
  const best: SavedRoll[] = [];
  for (const r of top) {
    if (!isRecord(r) || !isRoll(r.roll) || !isTime(r.at) || !isCount(r.rollNumber) || !Array.isArray(r.badges)) continue;
    best.push({ roll: r.roll, at: r.at, rollNumber: r.rollNumber, badges: r.badges.filter((b): b is string => typeof b === 'string') });
  }
  return {
    game: 'rng-badges',
    version: 1,
    username: username.trim().slice(0, 40),
    createdAt,
    rolls,
    lastRoll: isRoll(lastRoll) ? lastRoll : null,
    found: finds,
    top: best.slice(0, 100),
  };
}
