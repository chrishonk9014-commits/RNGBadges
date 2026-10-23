/**
 * Regenerates src/shared/badges/odds.json — the exact probability of every
 * badge. Run after adding or changing badges: `npm run odds`.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { allBadgeDefs } from '../src/shared/badges/catalog/index';
import { computeOdds } from '../src/shared/badges/odds';

const started = performance.now();
const defs = allBadgeDefs();
const odds = computeOdds(defs);
const never = defs.filter((d) => odds[d.id] === 0).map((d) => d.id);
if (never.length) {
  console.error(`These badges can never be earned:\n  ${never.join('\n  ')}`);
  process.exit(1);
}

const sorted = Object.fromEntries(Object.entries(odds).sort(([a], [b]) => a.localeCompare(b)));
const out = fileURLToPath(new URL('../src/shared/badges/odds.json', import.meta.url));
writeFileSync(out, `${JSON.stringify(sorted, null, 1)}\n`);
console.log(`Wrote odds for ${defs.length} badges in ${((performance.now() - started) / 1000).toFixed(1)}s → ${out}`);
