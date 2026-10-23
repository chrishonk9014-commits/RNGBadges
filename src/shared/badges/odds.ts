import { RARITIES, rarityIndexForXp } from '../progression';
import { MAX_ROLL, ROLL_OUTCOMES, SEVEN_DIGIT_NUMBER, normalRoll, sevenDigitRoll, skipCountProbability } from '../roll';
import { XP_CURVE, type XpCurve } from '../xp';
import { BadgeDetector } from './detector';
import { BadgeRegistry } from './registry';
import type { BadgeDef } from './types';

/** Every possible roll with the badges it earns: all six-digit numbers, then 1000000 with 0–7 skips. */
export interface Outcomes {
  /** Weight of each outcome in units of one six-digit roll: 1 each, and the skip probabilities for 1000000. Divide by ROLL_OUTCOMES for a probability. */
  weights: Float64Array;
  /** Badges of outcome i are items[offsets[i]] … items[offsets[i + 1] - 1], as indexes into defs. */
  offsets: Int32Array;
  items: Int32Array;
}

/** Context badges can't be enumerated from the roll alone; they are left out here and declare their odds. */
export function enumerateOutcomes(defs: readonly BadgeDef[]): Outcomes {
  const detector = new BadgeDetector(defs);
  const index = new Map(defs.map((d, i) => [d.id, i]));
  const count = MAX_ROLL + SEVEN_DIGIT_NUMBER.length + 1;
  const weights = new Float64Array(count);
  const offsets = new Int32Array(count + 1);
  const items: number[] = [];
  let k = 0;
  const add = (ids: string[], weight: number) => {
    offsets[k] = items.length;
    for (const id of ids) items.push(index.get(id)!);
    weights[k++] = weight;
  };
  for (let v = 0; v < MAX_ROLL; v++) add(detector.detect(normalRoll(v)), 1);
  for (let skips = 0; skips <= SEVEN_DIGIT_NUMBER.length; skips++) {
    add(detector.detect(sevenDigitRoll(skips)), skipCountProbability(skips));
  }
  offsets[k] = items.length;
  return { weights, offsets, items: Int32Array.from(items) };
}

/** Exact per-roll probability of every badge. */
export function computeOdds(defs: readonly BadgeDef[], outcomes = enumerateOutcomes(defs)): Record<string, number> {
  const hits = new Float64Array(defs.length);
  const { weights, offsets, items } = outcomes;
  for (let r = 0; r < weights.length; r++) {
    for (let j = offsets[r]!; j < offsets[r + 1]!; j++) hits[items[j]!]! += weights[r]!;
  }
  const odds: Record<string, number> = {};
  defs.forEach((def, i) => {
    odds[def.id] = def.rule.kind === 'context' ? def.rule.probability : hits[i]! / ROLL_OUTCOMES;
  });
  return odds;
}

export interface RarityOdds {
  /** Chance a roll lands exactly in this rarity. */
  band: number;
  /** Chance a roll is this rarity or better. */
  atLeast: number;
}

/**
 * Exact chance of each roll rarity, summing badge XP over every possible roll.
 * Context badges (previous roll, clock) are rare enough to leave out.
 */
export function computeRarityOdds(
  defs: readonly BadgeDef[],
  odds: Record<string, number>,
  curve: XpCurve = XP_CURVE,
  outcomes = enumerateOutcomes(defs),
): Record<string, RarityOdds> {
  const xp = new BadgeRegistry(defs, odds, curve).badges.map((b) => b.xp);
  const band = new Float64Array(RARITIES.length);
  const { weights, offsets, items } = outcomes;
  for (let r = 0; r < weights.length; r++) {
    let total = 0;
    for (let j = offsets[r]!; j < offsets[r + 1]!; j++) total += xp[items[j]!]!;
    band[rarityIndexForXp(total)]! += weights[r]!;
  }
  const out: Record<string, RarityOdds> = {};
  let atLeast = 0;
  for (let i = RARITIES.length - 1; i >= 0; i--) {
    atLeast += band[i]!;
    out[RARITIES[i]!.id] = { band: band[i]! / ROLL_OUTCOMES, atLeast: Math.min(1, atLeast / ROLL_OUTCOMES) };
  }
  return Object.fromEntries(RARITIES.map((r) => [r.id, out[r.id]!]));
}
