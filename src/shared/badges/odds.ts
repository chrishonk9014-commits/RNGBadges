import { MAX_ROLL, ROLL_OUTCOMES, SEVEN_DIGIT_NUMBER, normalRoll, sevenDigitRoll, skipCountProbability } from '../roll';
import { BadgeDetector } from './detector';
import type { BadgeDef } from './types';

/**
 * Exact per-roll probability of every badge, by brute force: all 1,000,000
 * six-digit outcomes plus the 1000000 outcome split into its eight skip
 * results, each weighted by its true probability. Context badges can't be
 * enumerated from the roll alone and use the probability they declare.
 */
export function computeOdds(defs: readonly BadgeDef[]): Record<string, number> {
  const detector = new BadgeDetector(defs);
  const hits = new Map<string, number>();
  for (const def of defs) hits.set(def.id, 0);

  for (let v = 0; v < MAX_ROLL; v++) {
    for (const id of detector.detect(normalRoll(v))) hits.set(id, hits.get(id)! + 1);
  }
  for (let skips = 0; skips <= SEVEN_DIGIT_NUMBER.length; skips++) {
    const weight = skipCountProbability(skips);
    for (const id of detector.detect(sevenDigitRoll(skips))) hits.set(id, hits.get(id)! + weight);
  }

  const odds: Record<string, number> = {};
  for (const def of defs) {
    odds[def.id] = def.rule.kind === 'context' ? def.rule.probability : hits.get(def.id)! / ROLL_OUTCOMES;
  }
  return odds;
}
