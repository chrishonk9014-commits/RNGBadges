import { describe, expect, it } from 'vitest';
import { LOCAL_TOKEN, LocalGame, LocalGameError, SAVE_KEY, parseSave, type KeyValueStore } from '../src/client/local/localGame';
import { getRegistry } from '../src/shared/badges/registry';
import { rarityForXp } from '../src/shared/progression';
import type { RandomSource } from '../src/shared/rng';
import { MAX_ROLL } from '../src/shared/roll';

/** Rolls whatever is queued (0–999999, or MAX_ROLL for 1000000); 123456 when empty. */
class QueueRandom implements RandomSource {
  values: number[] = [];
  queue(...rolls: number[]): void {
    this.values.push(...rolls);
  }
  int(max: number): number {
    return this.values.shift() ?? 123_456 % max;
  }
}

class MemoryStore implements KeyValueStore {
  data = new Map<string, string>();
  failWrites = false;
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error('QuotaExceededError');
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

function setup(storage: KeyValueStore | null = new MemoryStore()) {
  const rng = new QueueRandom();
  let clock = Date.UTC(2026, 9, 23, 12, 0, 0);
  const game = new LocalGame({ storage, rng, now: () => (clock += 1000) });
  return { game, rng, storage };
}

describe('browser game', () => {
  it('needs a save before it can roll, then creates one', () => {
    const { game } = setup();
    expect(() => game.profile()).toThrow(LocalGameError);
    const { token, player } = game.register();
    expect(token).toBe(LOCAL_TOKEN);
    expect(player.username).toMatch(/^[A-Za-z]+\d+$/);
    expect(player.rolls).toBe(0);
    expect(game.profile().best).toBeNull();
  });

  it('scores each roll on its own, exactly like the server', () => {
    const { game, rng } = setup();
    game.register();
    rng.queue(7);
    const r = game.roll(0);
    expect(r.roll.text).toBe('000007');
    expect(r.badges.at(-1)!.id).toBe('ref.bond.only');
    expect(r.badges.every((b) => b.isNew)).toBe(true);
    expect(r.xp).toBe(r.badges.reduce((s, b) => s + b.xp, 0));
    expect(r.rarity).toBe(rarityForXp(r.xp).id);
    expect(r.bestImproved).toBe(true);
    expect(r.player).toMatchObject({ rolls: 1, uniqueBadges: r.badges.length, bestXp: r.xp });

    rng.queue(7);
    const again = game.roll(0);
    expect(again.badges.filter((b) => b.isNew).map((b) => b.id)).toEqual(['meta.deja-vu']);
    expect(again.xp).toBe(r.xp + getRegistry().get('meta.deja-vu')!.xp);
    expect(again.rollNumber).toBe(2);

    rng.queue(984_271);
    const dull = game.roll(0);
    expect(dull.bestImproved).toBe(false);
    expect(dull.player.bestXp).toBe(again.xp);
    expect(new Set([r.id, again.id, dull.id]).size).toBe(3);
  });

  it('rolls 1000000 with its skips', () => {
    const { game, rng } = setup();
    game.register();
    rng.queue(MAX_ROLL, 0, 0, 5);
    const r = game.roll(0);
    expect(r.roll.text).toBe('(skip)(skip)00000');
    expect(r.badges.map((b) => b.id)).toContain('special.skip-2');
    expect(r.rarity).toBe('infinite');
  });

  it('keeps progress across page loads and between tabs', () => {
    const storage = new MemoryStore();
    const a = setup(storage);
    a.game.register();
    a.game.rename('Roller_One');
    a.rng.queue(551_267);
    a.game.roll(0);

    // A second tab rolls on the same save; the first tab's next roll builds on it.
    const b = setup(storage);
    expect(b.game.profile().player).toMatchObject({ username: 'Roller_One', rolls: 1 });
    b.rng.queue(7);
    b.game.roll(0);
    a.rng.queue(123_321);
    const third = a.game.roll(0);
    expect(third.rollNumber).toBe(3);

    const profile = setup(storage).game.profile();
    expect(profile.discoveries.map((d) => d.badgeId)).toEqual(expect.arrayContaining(['math.equation', 'ref.bond.only']));
    expect(profile.discoveries.find((d) => d.badgeId === 'math.equation')!.roll).toBe('551267');
    expect(profile.best?.roll).toBe('000007');
  });

  it('ranks the ten best rolls, best first', () => {
    const { game, rng } = setup();
    game.register();
    const numbers = [984_271, 7, 551_267, 123_321, 676_767, 111_111, 420_420, 202_020, 314_159, 271_828, 999_999, 13];
    rng.queue(...numbers);
    for (let i = 0; i < numbers.length; i++) game.roll(0);
    const top = game.topRolls().rolls;
    expect(top).toHaveLength(10);
    for (let i = 1; i < top.length; i++) expect(top[i]!.xp).toBeLessThanOrEqual(top[i - 1]!.xp);
    expect(top[0]!.roll).toBe('000007');
    expect(top[0]!.rollNumber).toBe(2);
    expect(top[0]!.badges[0]!.id).toBe('ref.bond.only');
  });

  it('exports and imports a save file', () => {
    const first = setup();
    first.game.register();
    first.rng.queue(7);
    first.game.roll(0);
    const file = first.game.exportSave();

    const second = setup();
    second.game.register();
    const profile = second.game.importSave(file);
    expect(profile.player.rolls).toBe(1);
    expect(profile.best?.roll).toBe('000007');
    expect(() => second.game.importSave('{"hello":"world"}')).toThrow(LocalGameError);
    expect(() => second.game.importSave('not json')).toThrow(LocalGameError);
    expect(second.game.profile().player.rolls).toBe(1);
  });

  it('drops malformed parts of a save and ignores badges that no longer exist', () => {
    const save = parseSave(
      JSON.stringify({
        game: 'rng-badges',
        version: 1,
        username: 'Edited',
        createdAt: 1,
        rolls: 3,
        lastRoll: 'banana',
        found: { 'ref.bond': [1, '210074', 1], 'retired.badge': [2, '000001', 2], 'ref.bond.ends': ['x'] },
        top: [{ roll: '210074', at: 1, rollNumber: 1, badges: ['ref.bond', 42] }, { roll: 'nope' }],
      }),
    )!;
    expect(save.lastRoll).toBeNull();
    expect(Object.keys(save.found)).toEqual(['ref.bond', 'retired.badge']);
    expect(save.top).toEqual([{ roll: '210074', at: 1, rollNumber: 1, badges: ['ref.bond'] }]);

    const { game, storage } = setup();
    storage!.setItem(SAVE_KEY, JSON.stringify(save));
    expect(game.profile().player.uniqueBadges).toBe(1);
  });

  it('sets an unreadable save aside instead of overwriting it', () => {
    const storage = new MemoryStore();
    storage.setItem(SAVE_KEY, '{broken');
    const { game } = setup(storage);
    expect(() => game.profile()).toThrow(LocalGameError);
    game.register();
    expect(storage.getItem(`${SAVE_KEY}.unreadable`)).toBe('{broken');
  });

  it('keeps playing when the browser won’t store anything', () => {
    const storage = new MemoryStore();
    storage.failWrites = true;
    const { game, rng } = setup(storage);
    game.register();
    expect(game.persistent).toBe(false);
    rng.queue(7);
    expect(game.roll(0).player.rolls).toBe(1);
    expect(game.profile().player.rolls).toBe(1);

    const memoryOnly = setup(null);
    memoryOnly.game.register();
    expect(memoryOnly.game.persistent).toBe(false);
    expect(memoryOnly.game.roll(0).rollNumber).toBe(1);
  });

  it('hides secret badges in the catalog until found', () => {
    const { game } = setup();
    const secret = game.catalog().badges.find((b) => b.id === 'special.skip-1')!;
    expect(secret.name).toBe('???');
    expect(game.catalog().badges).toHaveLength(getRegistry().badges.length);
  });
});
