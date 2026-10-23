/**
 * Regenerates the exact odds the game relies on:
 *   src/shared/badges/odds.json        — the per-roll probability of every badge
 *   src/shared/badges/rarityOdds.json  — the per-roll probability of every roll rarity
 * Run after changing badges, the XP curve or the rarity thresholds: `npm run odds`.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { allBadgeDefs } from '../src/shared/badges/catalog/index';
import { computeOdds, computeRarityOdds, enumerateOutcomes } from '../src/shared/badges/odds';

const started = performance.now();
const defs = allBadgeDefs();
const outcomes = enumerateOutcomes(defs);
const odds = computeOdds(defs, outcomes);
const never = defs.filter((d) => odds[d.id] === 0).map((d) => d.id);
if (never.length) {
  console.error(`These badges can never be earned:\n  ${never.join('\n  ')}`);
  process.exit(1);
}
const rarityOdds = computeRarityOdds(defs, odds, undefined, outcomes);

const write = (name: string, data: unknown) => {
  const out = fileURLToPath(new URL(`../src/shared/badges/${name}`, import.meta.url));
  writeFileSync(out, `${JSON.stringify(data, null, 1)}\n`);
  return out;
};
write('odds.json', Object.fromEntries(Object.entries(odds).sort(([a], [b]) => a.localeCompare(b))));
write('rarityOdds.json', rarityOdds);
console.log(`Wrote odds for ${defs.length} badges and ${Object.keys(rarityOdds).length} roll rarities in ${((performance.now() - started) / 1000).toFixed(1)}s`);
