import { describe, expect, it } from 'vitest';
import { allBadgeDefs, validateDefs } from '../src/shared/badges/catalog/index';
import { BadgeDetector } from '../src/shared/badges/detector';
import { computeFacts } from '../src/shared/badges/facts';
import {
  FERMAT_PRIMES,
  MERSENNE_PRIMES,
  highlyComposite,
  isKaprekar,
  isNarcissistic,
  perfectNumbers,
  taxicabNumbers,
} from '../src/shared/badges/numberTheory';
import { computeOdds, computeRarityOdds, enumerateOutcomes } from '../src/shared/badges/odds';
import oddsJson from '../src/shared/badges/odds.json';
import { getRegistry, RARITY_ODDS } from '../src/shared/badges/registry';
import type { BadgeDef, RollContext, RollFacts } from '../src/shared/badges/types';
import { ROLL_OUTCOMES, normalRoll, pad6, sevenDigitRoll, skipCountProbability, type Roll } from '../src/shared/roll';
import { seededRandom } from '../src/shared/rng';

const defs = allBadgeDefs();
const detector = new BadgeDetector(defs);
const detect = (digits: string, ctx?: RollContext): string[] => detector.detect(normalRoll(Number(digits)), ctx);
const ctx = (overrides: Partial<RollContext> = {}): RollContext => ({
  previous: null,
  rollNumber: 1,
  local: { year: 2026, month: 10, day: 23, hour: 14, minute: 5, second: 9 },
  ...overrides,
});

/** Reference implementation: evaluate one rule directly, no indexes. */
function naiveMatch(def: BadgeDef, facts: RollFacts, c?: RollContext): boolean {
  const { rule } = def;
  const d = facts.digits;
  switch (rule.kind) {
    case 'contains':
      return d.includes(rule.value);
    case 'startsWith':
      return d.startsWith(rule.value);
    case 'endsWith':
      return d.endsWith(rule.value);
    case 'exact':
      return d === rule.value;
    case 'mask':
      return rule.mask.length === d.length && [...rule.mask].every((ch, i) => ch === '_' || ch === d[i]);
    case 'values':
      return facts.value >= 0 && rule.values.includes(facts.value);
    case 'skips':
      return facts.roll.seven && facts.roll.skips === rule.count;
    case 'test':
      return rule.test(facts);
    case 'context':
      return c ? rule.test(facts, c) : false;
  }
}

describe('catalog', () => {
  it('has unique ids, names and rules', () => {
    expect(() => validateDefs(defs)).not.toThrow();
    expect(new Set(defs.map((d) => d.id)).size).toBe(defs.length);
  });

  it('rejects duplicate rules and names', () => {
    const a: BadgeDef = { id: 'test.a', name: 'A', description: 'x', category: 'reference', rule: { kind: 'contains', value: '123' } };
    expect(() => validateDefs([a, { ...a, id: 'test.b', name: 'B' }])).toThrow(/same rule/);
    expect(() => validateDefs([a, { ...a, id: 'test.b', rule: { kind: 'contains', value: '124' } }])).toThrow(/already used/);
  });

  it('has odds for every badge, and every badge is possible', () => {
    const registry = getRegistry();
    for (const b of registry.badges) expect(b.probability, b.id).toBeGreaterThan(0);
    expect(Object.keys(oddsJson).sort()).toEqual(defs.map((d) => d.id).sort());
  });
});

describe('the brief’s example badges', () => {
  it('funny-number positions', () => {
    expect(detect('213456')).toContain('funny.21-start');
    expect(detect('551111')).toContain('funny.55-start');
    expect(detect('670000')).toContain('funny.67-start');
    expect(detect('619999')).toContain('funny.61-start');
    expect(detect('410000')).toContain('funny.41-start');
    expect(detect('699999')).toContain('funny.69-start');
    expect(detect('002100')).toContain('funny.21-center');
    expect(detect('000670')).toContain('funny.67-offset');
    // Positional means positional: 21 elsewhere doesn't count.
    expect(detect('321000')).not.toContain('funny.21-start');
    expect(detect('321000')).not.toContain('funny.21-center');
  });

  it('specific combinations are separate badges', () => {
    const double = detect('212199');
    expect(double).toContain('funny.2121');
    expect(double).toContain('funny.21-start');

    const triple67 = detect('676767');
    expect(triple67).toContain('funny.676767');
    expect(triple67).not.toContain('funny.696969');

    const nice = detect('696969');
    expect(nice).toContain('funny.696969');
    expect(nice).not.toContain('funny.676767');
  });

  it('Math Equation! is one badge for every AB + CD = EF', () => {
    expect(detect('551267')).toContain('math.equation');
    expect(detect('101222')).toContain('math.equation');
    expect(detect('551268')).not.toContain('math.equation');
  });

  it('Binary is 010101', () => {
    expect(detect('010101')).toContain('ref.binary');
  });

  it('James Bond pays more the closer the roll is to just 007', () => {
    expect(detect('210074')).toContain('ref.bond');
    expect(detect('210074')).not.toContain('ref.bond.ends');
    expect(detect('913007')).toEqual(expect.arrayContaining(['ref.bond', 'ref.bond.ends']));
    expect(detect('913007')).not.toContain('ref.bond.only');
    expect(detect('000007')).toEqual(expect.arrayContaining(['ref.bond', 'ref.bond.ends', 'ref.bond.only']));
    const registry = getRegistry();
    const [spotted, ends, only] = ['ref.bond', 'ref.bond.ends', 'ref.bond.only'].map((id) => registry.get(id)!);
    expect(spotted!.xp).toBeLessThan(ends!.xp);
    expect(ends!.xp * 100).toBeLessThan(only!.xp);
  });

  it('one roll can earn many different badges, each once', () => {
    const ids = detect('000000');
    expect(ids.length).toBeGreaterThan(15);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(['special.absolute-zero', 'poker.six-kind', 'pattern.palindrome', 'pattern.lead-5']));
  });

  it('skip outcomes have their own badges', () => {
    expect(detector.detect(sevenDigitRoll(0))).toContain('special.the-million');
    expect(detector.detect(sevenDigitRoll(1))).toContain('special.skip-1');
    expect(detector.detect(sevenDigitRoll(7))).toEqual(['special.skip-7']);
  });
});

describe('context badges', () => {
  it('Déjà Vu, Next in Line and Mirror Roll compare with the previous roll', () => {
    expect(detect('123456', ctx({ previous: normalRoll(123456) }))).toContain('meta.deja-vu');
    expect(detect('123457', ctx({ previous: normalRoll(123456) }))).toContain('meta.next-in-line');
    expect(detect('654321', ctx({ previous: normalRoll(123456) }))).toContain('meta.mirror-roll');
    expect(detect('123321', ctx({ previous: normalRoll(123321) }))).not.toContain('meta.mirror-roll');
  });

  it('Odometer, Today and Clock Watcher use the player’s context', () => {
    expect(detect('004821', ctx({ rollNumber: 4821 }))).toContain('meta.odometer');
    expect(detect('102326', ctx())).toContain('meta.todays-date');
    expect(detect('102399', ctx())).toContain('meta.date-stamp');
    expect(detect('140509', ctx())).toContain('meta.clock-watcher');
  });

  it('are never awarded without context', () => {
    expect(detect('102326')).not.toContain('meta.todays-date');
  });
});

describe('indexed detection matches naive evaluation', () => {
  it('on random rolls, skip outcomes and edge cases', () => {
    const rng = seededRandom(5);
    const rolls: Roll[] = [normalRoll(0), normalRoll(999_999), normalRoll(7), normalRoll(551_267)];
    for (let k = 0; k <= 7; k++) rolls.push(sevenDigitRoll(k));
    for (let i = 0; i < 3000; i++) rolls.push(normalRoll(rng.int(1_000_000)));
    const c = ctx({ previous: normalRoll(123_456), rollNumber: 777 });
    for (const roll of rolls) {
      const facts = computeFacts(roll);
      const expected = defs.filter((d) => naiveMatch(d, facts, c)).map((d) => d.id).sort();
      expect(detector.detect(roll, c).sort()).toEqual(expected);
    }
  });
});

describe('exact odds', () => {
  const odds = oddsJson as Record<string, number>;

  it('match hand-derived counts', () => {
    expect(odds['funny.21-start']).toBeCloseTo(10_000 / ROLL_OUTCOMES, 15);
    expect(odds['funny.2121']).toBeCloseTo(100 / ROLL_OUTCOMES, 15);
    expect(odds['funny.676767']).toBeCloseTo(1 / ROLL_OUTCOMES, 18);
    // AB + CD = EF: for each AB there are 100 − AB choices of CD. "(skip)000000" also leaves
    // six zeros (00 + 00 = 00), with probability skipCountProbability(1).
    expect(odds['math.equation']).toBeCloseTo((5050 + skipCountProbability(1)) / ROLL_OUTCOMES, 15);
    // "007" fits at 4 positions; 007007 is counted twice.
    expect(odds['ref.bond']).toBeCloseTo(3999 / ROLL_OUTCOMES, 15);
    expect(odds['ref.bond.ends']).toBeCloseTo(1000 / ROLL_OUTCOMES, 15);
    expect(odds['ref.bond.only']).toBeCloseTo(1 / ROLL_OUTCOMES, 18);
    // Perfect squares: 0² … 999² as six-digit rolls, 1000000 (= 1000²) unskipped, and the value 0
    // left by 1–6 skips. Seven skips leave no number at all.
    expect(odds['math.square']).toBeCloseTo((1000 + 1 - skipCountProbability(7)) / ROLL_OUTCOMES, 15);
  });

  it('for skip outcomes', () => {
    expect(odds['special.the-million']).toBeCloseTo(0.9 / ROLL_OUTCOMES, 18);
    for (let k = 1; k <= 7; k++) expect(odds[`special.skip-${k}`]).toBeCloseTo(skipCountProbability(k) / ROLL_OUTCOMES, 22);
  });

  it('are up to date with the catalog (`npm run odds`)', () => {
    const outcomes = enumerateOutcomes(defs);
    const fresh = computeOdds(defs, outcomes);
    for (const d of defs) expect(fresh[d.id], d.id).toBeCloseTo(odds[d.id]!, 15);
    // Roll rarity odds depend on the XP curve too, so they go stale when it changes.
    expect(computeRarityOdds(defs, odds, undefined, outcomes)).toEqual(RARITY_ODDS);
  });
});

describe('number theory sets', () => {
  it('contain the textbook members', () => {
    expect(perfectNumbers()).toEqual([6, 28, 496, 8128]);
    expect(FERMAT_PRIMES).toEqual([3, 5, 17, 257, 65537]);
    expect(MERSENNE_PRIMES).toEqual([3, 7, 31, 127, 8191, 131071, 524287]);
    expect(taxicabNumbers().slice(0, 3)).toEqual([1729, 4104, 13832]);
    expect(highlyComposite()).toContain(720720);
    for (const n of [153, 370, 371, 407, 1634, 8208, 9474, 54748, 548834]) expect(isNarcissistic(n), String(n)).toBe(true);
    for (const n of [9, 45, 55, 297, 703, 142857]) expect(isKaprekar(n), String(n)).toBe(true);
  });
});

it('pad6 keeps leading zeros', () => {
  expect(pad6(7)).toBe('000007');
});

describe('scale', () => {
  it('detects against a 5,000-badge catalog without scanning it', () => {
    const extra: BadgeDef[] = [];
    for (let i = 0; i < 4000; i++) {
      const value = String(1000 + i * 2);
      extra.push({ id: `scale.c${i}`, name: `C${i}`, description: 'x', category: 'reference', rule: { kind: 'contains', value } });
    }
    for (let i = 0; i < 1000; i++) {
      extra.push({ id: `scale.e${i}`, name: `E${i}`, description: 'x', category: 'reference', rule: { kind: 'exact', value: pad6(i * 997) } });
    }
    const big = new BadgeDetector([...defs, ...extra]);
    const rng = seededRandom(3);
    const rolls = Array.from({ length: 20_000 }, () => normalRoll(rng.int(1_000_000)));
    const started = performance.now();
    for (const roll of rolls) big.detect(roll);
    const perRollMs = (performance.now() - started) / rolls.length;
    expect(perRollMs).toBeLessThan(0.5);
    expect(big.detect(normalRoll(1000))).toContain('scale.c0');
    expect(big.detect(normalRoll(997))).toContain('scale.e1');
  });
});
