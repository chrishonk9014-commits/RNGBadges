import { describe, expect, it } from 'vitest';
import { seededRandom, type RandomSource } from '../src/shared/rng';
import {
  MAX_ROLL,
  ROLL_OUTCOMES,
  SEVEN_DIGIT_NUMBER,
  formatRoll,
  normalRoll,
  parseRoll,
  rollCells,
  rollNumber,
  rollSkips,
  sevenDigitRoll,
  skipCountProbability,
} from '../src/shared/roll';

/** Returns the scripted values in order, then fails loudly. */
function scripted(values: number[]): RandomSource {
  const queue = [...values];
  return {
    int(max) {
      const v = queue.shift();
      if (v === undefined) throw new Error('script exhausted');
      if (v < 0 || v >= max) throw new Error(`scripted ${v} outside [0, ${max})`);
      return v;
    },
  };
}

describe('normal rolls', () => {
  it('are six digits with leading zeros preserved', () => {
    expect(normalRoll(7).digits).toBe('000007');
    expect(normalRoll(0).digits).toBe('000000');
    expect(normalRoll(999_999).digits).toBe('999999');
    expect(formatRoll(normalRoll(551_267))).toBe('551267');
  });

  it('draw from 1,000,001 equally likely outcomes', () => {
    expect(ROLL_OUTCOMES).toBe(1_000_001);
    expect(rollNumber(scripted([42])).digits).toBe('000042');
    expect(rollNumber(scripted([MAX_ROLL - 1])).digits).toBe('999999');
  });

  it('spread evenly across leading digits (chi-square)', () => {
    const rng = seededRandom(7);
    const counts = new Array(10).fill(0);
    const n = 200_000;
    for (let i = 0; i < n; i++) counts[Number(rollNumber(rng).digits[0])]++;
    const expected = n / 10;
    const chi = counts.reduce((s, c) => s + (c - expected) ** 2 / expected, 0);
    expect(chi).toBeLessThan(27.9); // p = 0.001 for 9 degrees of freedom
  });
});

describe('the 1000000 skip mechanic', () => {
  it('is the only seven-digit roll', () => {
    const roll = rollNumber(scripted([MAX_ROLL, 5]));
    expect(roll).toEqual({ digits: '1000000', skips: 0, seven: true });
    expect(formatRoll(roll)).toBe('1000000');
  });

  it('skips left to right and stops at the first digit that does not skip', () => {
    // 0 = "skip" on the 1-in-10 die. Third check doesn't skip, so the fourth value is never read.
    const rng = scripted([MAX_ROLL, 0, 0, 4]);
    const roll = rollNumber(rng);
    expect(formatRoll(roll)).toBe('(skip)(skip)00000');
    expect(roll.digits).toBe(SEVEN_DIGIT_NUMBER.slice(2));
  });

  it('can skip all the way down to one digit, or to nothing', () => {
    expect(formatRoll(rollNumber(scripted([MAX_ROLL, 0, 0, 0, 0, 0, 0, 9])))).toBe('(skip)(skip)(skip)(skip)(skip)(skip)0');
    expect(formatRoll(rollNumber(scripted([MAX_ROLL, 0, 0, 0, 0, 0, 0, 0])))).toBe('(skip)'.repeat(7));
  });

  it('never produces a skip after a kept digit', () => {
    const rng = seededRandom(99);
    for (let i = 0; i < 200_000; i++) {
      const skips = rollSkips(rng);
      const text = formatRoll(sevenDigitRoll(skips));
      expect(text).toMatch(/^(\(skip\))*\d*$/);
      expect(text.replace(/\(skip\)/g, '')).toBe(SEVEN_DIGIT_NUMBER.slice(skips));
    }
  });

  it('has exact skip-count probabilities that sum to 1', () => {
    expect(skipCountProbability(0)).toBeCloseTo(0.9, 15);
    expect(skipCountProbability(1)).toBeCloseTo(0.09, 15);
    expect(skipCountProbability(6)).toBeCloseTo(9e-7, 18);
    expect(skipCountProbability(7)).toBeCloseTo(1e-7, 18);
    let total = 0;
    for (let k = 0; k <= 7; k++) total += skipCountProbability(k);
    expect(total).toBeCloseTo(1, 14);
  });

  it('matches those probabilities in simulation', () => {
    const rng = seededRandom(1234);
    const n = 1_000_000;
    const counts = new Array(8).fill(0);
    for (let i = 0; i < n; i++) counts[rollSkips(rng)]++;
    // Within ~5 standard deviations of the expected count.
    for (const k of [0, 1, 2, 3]) {
      const p = skipCountProbability(k);
      const sd = Math.sqrt(n * p * (1 - p));
      expect(Math.abs(counts[k] - n * p)).toBeLessThan(5 * sd + 1);
    }
  });
});

describe('roll text', () => {
  it('round-trips everything the game can produce', () => {
    for (const roll of [normalRoll(7), normalRoll(551_267), ...Array.from({ length: 8 }, (_, k) => sevenDigitRoll(k))]) {
      expect(parseRoll(formatRoll(roll))).toEqual(roll);
    }
  });

  it('rejects patterns the skip rules forbid', () => {
    expect(parseRoll('5(skip)2391')).toBeNull();
    expect(parseRoll('1(skip)00000')).toBeNull();
    expect(parseRoll('(skip)56789')).toBeNull(); // skipped digits only ever come from 1000000
    expect(parseRoll('1234567')).toBeNull();
    expect(parseRoll('12345')).toBeNull();
  });

  it('renders skipped positions as cells first', () => {
    expect(rollCells(sevenDigitRoll(2)).map((c) => (c.kind === 'skip' ? 'S' : c.digit)).join('')).toBe('SS00000');
  });
});
