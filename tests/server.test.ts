import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { DatabaseSync } from 'node:sqlite';
import type { LeaderboardResponse, RegisterResponse, RollResponse, CollectionLeaderboardEntry, BestLeaderboardEntry, ProfileResponse, CatalogResponse } from '../src/shared/api';
import { allBadgeDefs } from '../src/shared/badges/catalog/index';
import oddsJson from '../src/shared/badges/odds.json';
import { BadgeRegistry, getRegistry } from '../src/shared/badges/registry';
import type { RandomSource } from '../src/shared/rng';
import { rarityForXp } from '../src/shared/progression';
import { MAX_ROLL } from '../src/shared/roll';
import { buildApp } from '../src/server/app';
import { openDatabase, type Database } from '../src/server/db';
import { GameService } from '../src/server/game';

/** Rolls whatever is queued: a number 0–999999, or 'million:k' for 1000000 with k skips. */
class QueueRandom implements RandomSource {
  private values: number[] = [];
  queue(...rolls: Array<number | `million:${number}`>): void {
    for (const r of rolls) {
      if (typeof r === 'number') this.values.push(r);
      else {
        const skips = Number(r.split(':')[1]);
        this.values.push(MAX_ROLL, ...Array(skips).fill(0), ...(skips < 7 ? [5] : []));
      }
    }
  }
  int(max: number): number {
    const v = this.values.shift();
    if (v === undefined) return 123_456 % max;
    return v;
  }
}

let app: FastifyInstance | null = null;

async function setup(opts: { rollBurst?: number; db?: Database; registry?: BadgeRegistry } = {}) {
  const db = opts.db ?? openDatabase(':memory:');
  const rng = new QueueRandom();
  let clock = Date.UTC(2026, 9, 23, 12, 0, 0);
  const now = () => clock;
  const game = new GameService({ db, rng, now, registry: opts.registry });
  app = await buildApp({ game, rollBurst: opts.rollBurst ?? 1000, rollsPerSecond: 1000, now });
  const call = async <T>(method: string, url: string, token?: string, payload?: unknown) => {
    const res = await app!.inject({
      method: method as 'GET',
      url,
      payload: payload as object,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    return { status: res.statusCode, body: res.json() as T };
  };
  const register = async (username?: string) =>
    (await call<RegisterResponse>('POST', '/api/players', undefined, username ? { username } : {})).body;
  return { db, rng, game, call, register, tick: (ms: number) => (clock += ms) };
}

afterEach(async () => {
  await app?.close();
  app = null;
});

describe('accounts', () => {
  it('creates a guest with a generated name and a save code', async () => {
    const { call, register } = await setup();
    const { token, player } = await register();
    expect(token.length).toBeGreaterThan(30);
    expect(player.username).toMatch(/^[A-Za-z]+\d+$/);
    const me = await call<ProfileResponse>('GET', '/api/me', token);
    expect(me.status).toBe(200);
    expect(me.body.player.id).toBe(player.id);
  });

  it('rejects bad, taken and missing credentials', async () => {
    const { call, register } = await setup();
    await register('Roller_One');
    expect((await call('POST', '/api/players', undefined, { username: 'roller_one' })).status).toBe(409);
    expect((await call('POST', '/api/players', undefined, { username: 'x' })).status).toBe(400);
    expect((await call('POST', '/api/players', undefined, { username: 'has space' })).status).toBe(400);
    expect((await call('GET', '/api/me', 'not-a-real-token')).status).toBe(401);
    expect((await call('POST', '/api/roll')).status).toBe(401);
  });

  it('renames', async () => {
    const { call, register } = await setup();
    const a = await register('Alpha');
    await register('Bravo');
    expect((await call('PATCH', '/api/me', a.token, { username: 'bravo' })).status).toBe(409);
    const ok = await call<{ username: string }>('PATCH', '/api/me', a.token, { username: 'alpha' });
    expect(ok.body.username).toBe('alpha');
  });
});

describe('rolling', () => {
  it('scores every roll on its own: all its badges, found before or not', async () => {
    const { call, register, rng } = await setup();
    const { token } = await register();
    rng.queue(7);
    const first = await call<RollResponse>('POST', '/api/roll', token, { tzOffset: 0 });
    expect(first.status).toBe(200);
    const r = first.body;
    expect(r.roll.text).toBe('000007');
    const ids = r.badges.map((b) => b.id);
    expect(ids).toEqual(expect.arrayContaining(['ref.bond', 'ref.bond.ends', 'ref.bond.only']));
    expect(ids.at(-1)).toBe('ref.bond.only');
    for (let i = 1; i < r.badges.length; i++) expect(r.badges[i]!.xp).toBeGreaterThanOrEqual(r.badges[i - 1]!.xp);
    expect(r.badges.every((b) => b.isNew)).toBe(true);
    expect(r.xp).toBe(r.badges.reduce((s, b) => s + b.xp, 0));
    expect(r.rarity).toBe(rarityForXp(r.xp).id);
    expect(r.bestImproved).toBe(true);
    expect(r.player.bestXp).toBe(r.xp);
    expect(r.player.uniqueBadges).toBe(r.badges.length);

    // The same number again scores everything again, plus Déjà Vu; only Déjà Vu is new.
    rng.queue(7);
    const again = (await call<RollResponse>('POST', '/api/roll', token)).body;
    expect(again.badges.map((b) => b.id).sort()).toEqual([...ids, 'meta.deja-vu'].sort());
    expect(again.badges.filter((b) => b.isNew).map((b) => b.id)).toEqual(['meta.deja-vu']);
    expect(again.xp).toBe(r.xp + getRegistry().get('meta.deja-vu')!.xp);
    expect(again.rollNumber).toBe(2);
    expect(again.player.uniqueBadges).toBe(r.badges.length + 1);

    // A dull roll after a great one starts from zero; the best roll stays.
    rng.queue(984_271);
    const dull = (await call<RollResponse>('POST', '/api/roll', token)).body;
    expect(dull.xp).toBe(dull.badges.reduce((s, b) => s + b.xp, 0));
    expect(dull.xp).toBeLessThan(r.xp);
    expect(dull.rarity).toBe(rarityForXp(dull.xp).id);
    expect(dull.bestImproved).toBe(false);
    expect(dull.player.bestXp).toBe(again.xp);
  });

  it('handles rolls with no badges', async () => {
    const { call, register, rng, game } = await setup();
    const { token } = await register();
    // Find a roll that earns nothing (no context badges either).
    let quiet = -1;
    for (let v = 1; v < MAX_ROLL && quiet < 0; v += 7919) {
      if (game.registry.detectorInstance.detect({ digits: String(v).padStart(6, '0'), skips: 0, seven: false }).length === 0) quiet = v;
    }
    expect(quiet).toBeGreaterThan(0);
    rng.queue(quiet);
    const r = (await call<RollResponse>('POST', '/api/roll', token)).body;
    expect(r.badges).toEqual([]);
    expect(r.xp).toBe(0);
    expect(r.rarity).toBe('common');
  });

  it('rolls 1000000 with skips and shows the skip markers', async () => {
    const { call, register, rng } = await setup();
    const { token } = await register();
    rng.queue('million:2');
    const r = (await call<RollResponse>('POST', '/api/roll', token)).body;
    expect(r.roll.text).toBe('(skip)(skip)00000');
    expect(r.roll.cells.filter((c) => c.kind === 'skip')).toHaveLength(2);
    expect(r.badges.map((b) => b.id)).toContain('special.skip-2');
  });

  it('rate-limits rapid rolling', async () => {
    const { call, register } = await setup({ rollBurst: 2 });
    const { token } = await register();
    expect((await call('POST', '/api/roll', token)).status).toBe(200);
    expect((await call('POST', '/api/roll', token)).status).toBe(200);
    const limited = await call<{ retryAfterMs: number }>('POST', '/api/roll', token);
    expect(limited.status).toBe(429);
    expect(limited.body.retryAfterMs).toBeGreaterThan(0);
  });

  it('persists progress across restarts', async () => {
    const db = openDatabase(':memory:');
    const first = await setup({ db });
    const { token } = await first.register();
    first.rng.queue(551267);
    const r = (await first.call<RollResponse>('POST', '/api/roll', token)).body;
    await app!.close();

    const second = await setup({ db });
    const me = (await second.call<ProfileResponse>('GET', '/api/me', token)).body;
    expect(me.player.bestXp).toBe(r.xp);
    expect(me.player.uniqueBadges).toBe(r.badges.length);
    expect(me.best?.roll).toBe('551267');
    expect(me.discoveries.map((d) => d.badgeId)).toContain('math.equation');
    expect(me.discoveries[0]!.roll).toBe('551267');
  });
});

describe('leaderboards', () => {
  it('rank by best roll and by badges found, and place you even outside the top', async () => {
    const { call, register, rng, tick } = await setup();
    const a = await register('Ace');
    const b = await register('Bee');
    const c = await register('Cee');
    rng.queue(7); // exact James Bond: a huge roll
    await call('POST', '/api/roll', a.token);
    tick(1000);
    rng.queue(213_456, 123_321, 551_267, 777_777); // lots of rolls: the biggest collection
    for (let i = 0; i < 4; i++) await call('POST', '/api/roll', b.token);
    tick(1000);
    rng.queue(984_271);
    await call('POST', '/api/roll', c.token);

    const best = (await call<LeaderboardResponse<BestLeaderboardEntry>>('GET', '/api/leaderboard/best?limit=2', c.token)).body;
    expect(best.entries).toHaveLength(2);
    expect(best.entries[0]!.username).toBe('Ace');
    expect(best.entries[0]!.roll).toBe('000007');
    expect(best.entries[0]!.badges[0]!.id).toBe('ref.bond.only');
    expect(best.entries[0]!.rarity).toBe(rarityForXp(best.entries[0]!.xp).id);
    expect(best.totalPlayers).toBe(3);
    expect(best.you?.username).toBe('Cee');
    expect(best.you!.rank).toBe(3);

    const collection = (await call<LeaderboardResponse<CollectionLeaderboardEntry>>('GET', '/api/leaderboard/collection', a.token)).body;
    expect(collection.entries[0]!.username).toBe('Bee');
    const me = (await call<ProfileResponse>('GET', '/api/me', b.token)).body;
    expect(collection.entries[0]!.badges).toBe(me.discoveries.length);
    expect(collection.you?.username).toBe('Ace');
  });

  it('do not rank by numeric size', async () => {
    const { call, register, rng } = await setup();
    const small = await register('Small');
    const big = await register('Big');
    rng.queue(153); // 000153: 1³ + 5³ + 3³ = 153, a narcissistic number
    await call('POST', '/api/roll', small.token);
    rng.queue(984_271); // big number, nothing much going on
    await call('POST', '/api/roll', big.token);
    const best = (await call<LeaderboardResponse<BestLeaderboardEntry>>('GET', '/api/leaderboard/best')).body;
    expect(best.entries[0]!.username).toBe('Small');
  });
});

describe('catalog', () => {
  it('redacts hidden badges until the player has found them', async () => {
    const { call, register, rng } = await setup();
    const catalog = (await call<CatalogResponse>('GET', '/api/catalog')).body;
    const secret = catalog.badges.find((b) => b.id === 'special.skip-1')!;
    expect(secret.revealed).toBe(false);
    expect(secret.name).toBe('???');
    expect(catalog.badges.length).toBe(getRegistry().badges.length);

    const { token } = await register();
    rng.queue('million:1');
    await call('POST', '/api/roll', token);
    const me = (await call<ProfileResponse>('GET', '/api/me', token)).body;
    expect(me.revealed.map((b) => b.name)).toContain('Skip!');
  });

  it('rescores best rolls when badge values change', async () => {
    const db = openDatabase(':memory:');
    const first = await setup({ db });
    const { token } = await first.register();
    first.rng.queue(551_267);
    const before = (await first.call<RollResponse>('POST', '/api/roll', token)).body.xp;
    await app!.close();

    const doubled = new BadgeRegistry(
      allBadgeDefs().map((d) => ({ ...d, xp: (getRegistry().get(d.id)!.xp) * 2 })),
      oddsJson as Record<string, number>,
    );
    const second = await setup({ db, registry: doubled });
    const me = (await second.call<ProfileResponse>('GET', '/api/me', token)).body;
    expect(me.player.bestXp).toBe(before * 2);
    expect(me.best?.xp).toBe(before * 2);
  });
});

describe('saves from before per-roll scoring', () => {
  it('drop the running XP total and keep every discovery', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rng-badges-'));
    const path = join(dir, 'old.db');
    const old = new DatabaseSync(path);
    old.exec(`
      CREATE TABLE players (
        id INTEGER PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        xp INTEGER NOT NULL DEFAULT 0, xp_updated_at INTEGER NOT NULL DEFAULT 0, rolls INTEGER NOT NULL DEFAULT 0,
        last_roll TEXT, best_score INTEGER NOT NULL DEFAULT 0, best_roll TEXT, best_badges TEXT, best_at INTEGER,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE discoveries (
        player_id INTEGER NOT NULL REFERENCES players (id) ON DELETE CASCADE, badge_id TEXT NOT NULL,
        discovered_at INTEGER NOT NULL, roll TEXT NOT NULL, roll_number INTEGER NOT NULL, PRIMARY KEY (player_id, badge_id)
      ) WITHOUT ROWID;
      CREATE INDEX players_by_xp ON players (xp DESC, xp_updated_at ASC);
      INSERT INTO players (id, token_hash, username, xp, xp_updated_at, rolls, created_at) VALUES (1, 'h', 'Old', 99999, 5, 2, 1);
      INSERT INTO discoveries VALUES (1, 'ref.bond', 10, '210074', 1), (1, 'funny.21-start', 20, '210074', 1);
    `);
    old.close();

    const db = openDatabase(path);
    const columns = (db.prepare('PRAGMA table_info(players)').all() as Array<{ name: string }>).map((c) => c.name);
    expect(columns).not.toContain('xp');
    expect(columns).toContain('badge_count');
    expect(db.prepare('SELECT badge_count, badge_count_at, rolls FROM players WHERE id = 1').get()).toEqual({ badge_count: 2, badge_count_at: 20, rolls: 2 });
    expect((db.prepare('SELECT COUNT(*) AS n FROM discoveries').get() as { n: number }).n).toBe(2);
    db.close();
    // Opening again is a no-op.
    openDatabase(path).close();
    rmSync(dir, { recursive: true, force: true });
  });
});
