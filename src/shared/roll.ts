import type { RandomSource } from './rng';

/**
 * A roll is a uniform draw from 000000–999999 plus the single seven-digit
 * outcome 1000000 (1,000,001 equally likely outcomes).
 *
 * When 1000000 comes up, the skip mechanic runs on its seven digit positions:
 * starting at the first digit, each position has a 1-in-10 chance to skip.
 * The first position that does NOT skip ends the process, so skips can only
 * ever form an unbroken run at the front ("(skip)(skip)00000", never
 * "1(skip)00000").
 */
export const MAX_ROLL = 1_000_000;
export const ROLL_OUTCOMES = MAX_ROLL + 1;
export const NORMAL_LENGTH = 6;
export const SEVEN_DIGIT_NUMBER = '1000000';
export const SKIP_CHANCE = 1 / 10;
export const SKIP_DIE_SIDES = 10;
export const SKIP_MARKER = '(skip)';

export interface Roll {
  /** Digits that were not skipped, leading zeros preserved ("000007", "1000000", "00000", ""). */
  digits: string;
  /** Leading positions skipped. Only the 1000000 outcome can skip. */
  skips: number;
  /** True when this roll came from the 1000000 outcome (skipped or not). */
  seven: boolean;
}

export function pad6(value: number): string {
  return String(value).padStart(NORMAL_LENGTH, '0');
}

export function normalRoll(value: number): Roll {
  if (!Number.isInteger(value) || value < 0 || value >= MAX_ROLL) {
    throw new RangeError(`normal rolls are 0–999999, got ${value}`);
  }
  return { digits: pad6(value), skips: 0, seven: false };
}

/** The 1000000 outcome with a given number of leading skips (0–7). */
export function sevenDigitRoll(skips: number): Roll {
  if (!Number.isInteger(skips) || skips < 0 || skips > SEVEN_DIGIT_NUMBER.length) {
    throw new RangeError(`skips must be 0–${SEVEN_DIGIT_NUMBER.length}, got ${skips}`);
  }
  return { digits: SEVEN_DIGIT_NUMBER.slice(skips), skips, seven: true };
}

/** Runs the left-to-right skip process. Stops at the first digit that does not skip. */
export function rollSkips(rng: RandomSource): number {
  let skips = 0;
  while (skips < SEVEN_DIGIT_NUMBER.length && rng.int(SKIP_DIE_SIDES) === 0) skips++;
  return skips;
}

export function rollNumber(rng: RandomSource): Roll {
  const value = rng.int(ROLL_OUTCOMES);
  if (value < MAX_ROLL) return normalRoll(value);
  return sevenDigitRoll(rollSkips(rng));
}

/**
 * Probability that the skip process produces exactly `skips` skips, given
 * that 1000000 was rolled. 0 → 9/10, 1 → 9/100, …, 6 → 9/10^7, 7 → 1/10^7.
 */
export function skipCountProbability(skips: number): number {
  const total = SEVEN_DIGIT_NUMBER.length;
  if (skips < 0 || skips > total) return 0;
  const run = SKIP_CHANCE ** skips;
  return skips === total ? run : run * (1 - SKIP_CHANCE);
}

/** Text form used everywhere a roll is shown: "(skip)(skip)00000", "551267". */
export function formatRoll(roll: Roll): string {
  return SKIP_MARKER.repeat(roll.skips) + roll.digits;
}

/** Parses the text form back into a roll. Returns null for anything the game can't produce. */
export function parseRoll(text: string): Roll | null {
  let skips = 0;
  let rest = text;
  while (rest.startsWith(SKIP_MARKER)) {
    skips++;
    rest = rest.slice(SKIP_MARKER.length);
  }
  if (!/^\d*$/.test(rest)) return null;
  if (skips > 0 || rest.length === SEVEN_DIGIT_NUMBER.length) {
    if (skips > SEVEN_DIGIT_NUMBER.length) return null;
    return rest === SEVEN_DIGIT_NUMBER.slice(skips) ? sevenDigitRoll(skips) : null;
  }
  return rest.length === NORMAL_LENGTH ? normalRoll(Number(rest)) : null;
}

/** Cells for rendering: one per digit position, skipped positions first. */
export type RollCell = { kind: 'skip' } | { kind: 'digit'; digit: string };

export function rollCells(roll: Roll): RollCell[] {
  const cells: RollCell[] = [];
  for (let i = 0; i < roll.skips; i++) cells.push({ kind: 'skip' });
  for (const digit of roll.digits) cells.push({ kind: 'digit', digit });
  return cells;
}
