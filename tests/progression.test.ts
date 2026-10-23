import { describe, expect, it } from 'vitest';
import { compareBadgeQuality, getRegistry, RARITY_ODDS, type CatalogBadge } from '../src/shared/badges/registry';
import { parseRoll } from '../src/shared/roll';
import { RARITIES, rarityForXp, rarityProgress } from '../src/shared/progression';
import { rollRarity, rollXp, standoutBadges } from '../src/shared/scoring';
import { BADGE_TIERS, XP_CURVE, roundXp, tierForProbability, xpForProbability } from '../src/shared/xp';
import { REVEAL, revealOffsets, shownAt } from '../src/client/reveal';

describe('rarity ladder', () => {
  it('uses the configured thresholds from the brief', () => {
    expect(RARITIES.map((r) => [r.name, r.minXp])).toEqual([
      ['Common', 0],
      ['Uncommon', 100],
      ['Notable', 300],
      ['Rare', 750],
      ['Epic', 1_500],
      ['Legendary', 3_000],
      ['Mythic', 6_000],
      ['Exotic', 12_000],
      ['Divine', 25_000],
      ['Celestial', 50_000],
      ['Transcendent', 100_000],
      ['Cosmic', 200_000],
      ['Universal', 400_000],
      ['Omniversal', 800_000],
      ['Unfathomable', 1_600_000],
      ['INFINITE', 3_200_000],
    ]);
  });

  it('maps XP to rarity and progress', () => {
    expect(rarityForXp(0).name).toBe('Common');
    expect(rarityForXp(99).name).toBe('Common');
    expect(rarityForXp(100).name).toBe('Uncommon');
    expect(rarityForXp(3_199_999).name).toBe('Unfathomable');
    expect(rarityForXp(10_000_000).name).toBe('INFINITE');
    const p = rarityProgress(200);
    expect(p.current.name).toBe('Uncommon');
    expect(p.next?.name).toBe('Notable');
    expect(p.fraction).toBeCloseTo(0.5);
    expect(rarityProgress(5_000_000).fraction).toBe(1);
  });
});

describe('roll rarity balance', () => {
  const registry = getRegistry();
  const rarityOf = (text: string) => {
    const roll = parseRoll(text);
    if (!roll) throw new Error(text);
    return rollRarity(registry.detectorInstance.detect(roll).map((id) => registry.get(id)!)).name;
  };

  it('puts the famous rolls where the ladder promises', () => {
    expect(rarityOf('000007')).toBe('Universal');
    expect(rarityOf('000000')).toBe('Omniversal');
    expect(rarityOf('1000000')).toBe('Unfathomable');
    expect(rarityOf('(skip)000000')).toBe('INFINITE');
    expect(rarityOf('(skip)(skip)(skip)(skip)(skip)(skip)(skip)')).toBe('INFINITE');
  });

  it('makes every one-in-a-million badge a jackpot on its own', () => {
    const cosmic = RARITIES.find((r) => r.id === 'cosmic')!.minXp;
    expect(registry.get('ref.bond.only')!.probability).toBeLessThanOrEqual(1e-6);
    for (const badge of registry.badges) {
      if (badge.probability <= 1e-6) expect(badge.xp, badge.id).toBeGreaterThanOrEqual(cosmic);
    }
  });

  it('pays more the closer a reference gets to the whole number', () => {
    const bond = ['ref.bond', 'ref.bond.ends', 'ref.bond.only'].map((id) => registry.get(id)!.xp);
    expect(bond[0]!).toBeLessThan(bond[1]!);
    expect(bond[1]!).toBeLessThan(bond[2]!);
  });

  it('gets rarer all the way up the ladder', () => {
    let last = 2;
    for (const r of RARITIES) {
      const odds = RARITY_ODDS[r.id];
      expect(odds, r.id).toBeDefined();
      expect(odds!.atLeast, r.id).toBeLessThan(last);
      expect(odds!.band, r.id).toBeLessThanOrEqual(odds!.atLeast);
      last = odds!.atLeast;
    }
    expect(RARITY_ODDS.common!.atLeast).toBe(1);
  });
});

describe('badge XP', () => {
  it('never pays less for a rarer badge', () => {
    let last = 0;
    for (let odds = 1; odds < 1e14; odds *= 1.07) {
      const xp = xpForProbability(1 / odds);
      expect(xp).toBeGreaterThanOrEqual(last);
      last = xp;
    }
  });

  it('stays within bounds and rounds to friendly numbers', () => {
    expect(xpForProbability(0.9)).toBe(XP_CURVE.minXp);
    expect(xpForProbability(1e-15)).toBe(XP_CURVE.maxXp);
    expect(roundXp(141)).toBe(140);
    expect(roundXp(16_740)).toBe(17_000);
    expect(roundXp(42)).toBe(40);
  });

  it('orders tiers by rarity', () => {
    expect(tierForProbability(0.5).id).toBe('common');
    expect(tierForProbability(1 / 1_000_001).id).toBe('legendary');
    expect(tierForProbability(1e-9).id).toBe('special-secret');
    for (let i = 1; i < BADGE_TIERS.length; i++) expect(BADGE_TIERS[i]!.minOdds).toBeGreaterThan(BADGE_TIERS[i - 1]!.minOdds);
  });

  it('ranks every catalog badge consistently: rarer is never worth less', () => {
    const badges = [...getRegistry().badges].sort((a, b) => b.probability - a.probability);
    for (let i = 1; i < badges.length; i++) expect(badges[i]!.xp, badges[i]!.id).toBeGreaterThanOrEqual(badges[i - 1]!.xp);
  });
});

describe('roll quality and score', () => {
  const b = (id: string, xp: number, probability: number): CatalogBadge => ({
    id,
    name: id,
    description: '',
    category: 'pattern',
    hidden: false,
    probability,
    xp,
    tier: 'common',
  });

  it('sorts worst to best, best last', () => {
    const sorted = [b('rare', 300, 1e-5), b('common', 5, 0.1), b('mid', 30, 1e-3), b('common2', 5, 0.2)].sort(compareBadgeQuality);
    expect(sorted.map((x) => x.id)).toEqual(['common2', 'common', 'mid', 'rare']);
  });

  it('scores a roll by the value of everything it triggered', () => {
    expect(rollXp([])).toBe(0);
    expect(rollRarity([]).id).toBe('common');
    expect(rollXp([b('a', 5, 0.1), b('b', 17_000, 1e-6)])).toBe(17_005);
    expect(rollRarity([b('a', 5, 0.1), b('b', 17_000, 1e-6)]).name).toBe('Exotic');
    expect(standoutBadges([b('a', 5, 0.1), b('b', 17_000, 1e-6), b('c', 30, 1e-3)], 2).map((x) => x.id)).toEqual(['b', 'c']);
  });
});

describe('Badges Collected reveal timing', () => {
  it('handles zero, one and many badges', () => {
    expect(revealOffsets(0, false)).toEqual([]);
    expect(revealOffsets(1, false)).toEqual([0]);
    const many = revealOffsets(30, false);
    expect(many).toHaveLength(30);
    for (let i = 1; i < many.length; i++) expect(many[i]!).toBeGreaterThan(many[i - 1]!);
    // Long lists still finish quickly.
    expect(many.at(-1)!).toBeLessThan(REVEAL.minStepMs * 30 + REVEAL.finalPauseMs + 1);
  });

  it('pauses before the best badge', () => {
    const o = revealOffsets(5, false);
    const lastGap = o[4]! - o[3]!;
    const firstGap = o[1]! - o[0]!;
    expect(lastGap).toBe(firstGap + REVEAL.finalPauseMs);
  });

  it('shows everything at once with reduced motion', () => {
    expect(revealOffsets(8, true)).toEqual(new Array(8).fill(0));
  });

  it('counts visible badges over time', () => {
    const o = revealOffsets(4, false);
    expect(shownAt(o, 0)).toBe(1);
    expect(shownAt(o, o[2]!)).toBe(3);
    expect(shownAt(o, 1e9)).toBe(4);
  });
});
