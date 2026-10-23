import { describe, expect, it } from 'vitest';
import { getRegistry } from '../src/shared/badges/registry';
import { RARITIES } from '../src/shared/progression';
import { FAMILIES, MEDIAN_TIME, SHOWCASE } from '../src/client/site/content';
import { badgesFor, readNumber } from '../src/client/site/engine';

describe('website content', () => {
  it('only names badges that exist', () => {
    const registry = getRegistry();
    for (const f of FAMILIES) {
      for (const id of f.examples) {
        const b = registry.get(id);
        expect(b, id).toBeDefined();
        expect(b!.category, id).toBe(f.category);
        expect(b!.hidden, `${id} would spoil a secret badge`).toBe(false);
      }
    }
    const categories = new Set(registry.badges.map((b) => b.category));
    expect(new Set(FAMILIES.map((f) => f.category))).toEqual(categories);
  });

  it('showcases rolls that earn badges', () => {
    for (const s of SHOWCASE) {
      const roll = readNumber(s.roll);
      expect(roll, s.roll).not.toBeNull();
      expect(badgesFor(roll!).length, s.roll).toBeGreaterThan(0);
    }
    expect(badgesFor(readNumber('551267')!).at(-1)!.id).toBe('math.equation');
    expect(badgesFor(readNumber('000007')!).at(-1)!.id).toBe('ref.bond.only');
  });

  it('has a time for every rarity', () => {
    for (const r of RARITIES) expect(MEDIAN_TIME[r.id], r.id).toBeDefined();
  });
});

describe('number checker input', () => {
  it('reads what people type', () => {
    expect(readNumber('7')?.digits).toBe('000007');
    expect(readNumber(' 551267 ')?.digits).toBe('551267');
    expect(readNumber('1000000')).toEqual({ digits: '1000000', skips: 0, seven: true });
    expect(readNumber('(skip)(skip)00000')?.skips).toBe(2);
    expect(readNumber('5(skip)2391')).toBeNull();
    expect(readNumber('1234567')).toBeNull();
    expect(readNumber('12a')).toBeNull();
  });
});
