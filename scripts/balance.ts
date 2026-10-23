/**
 * Balance report: how rare each roll rarity is with the current badges, odds,
 * XP curve and thresholds. A roll's XP is the XP of every badge it earned, so
 * everything here is exact: it walks all 1,000,001 rolls (and the 8 skip
 * outcomes of 1000000) through the detector once.
 *
 *   npm run balance                                     # report
 *   npm run balance -- --curve "1:5,100:120,…"          # try a different curve
 *   npm run balance -- --verify                         # also roll for real and compare
 */
import { allBadgeDefs } from '../src/shared/badges/catalog/index';
import { enumerateOutcomes } from '../src/shared/badges/odds';
import oddsJson from '../src/shared/badges/odds.json';
import { BadgeRegistry } from '../src/shared/badges/registry';
import { RARITIES, rarityIndexForXp } from '../src/shared/progression';
import { ROLL_OUTCOMES, parseRoll, rollNumber } from '../src/shared/roll';
import { seededRandom } from '../src/shared/rng';
import { rollXp } from '../src/shared/scoring';
import { BADGE_TIERS, XP_CURVE } from '../src/shared/xp';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const curveFlag = flag('curve');
const curve = {
  ...XP_CURVE,
  points: curveFlag
    ? curveFlag.split(',').map((pair) => pair.split(':').map(Number) as [number, number])
    : XP_CURVE.points,
};
/** Sustained rolls per second for an active player clicking steadily. */
const ROLLS_PER_SECOND = Number(flag('rate') ?? 2);
const ROLLS_PER_HOUR = ROLLS_PER_SECOND * 3600;

const defs = allBadgeDefs();
const registry = new BadgeRegistry(defs, oddsJson as Record<string, number>, curve);
const badges = registry.badges;
const fmt = (n: number): string => (Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : '—');
const oneIn = (p: number): string => (p <= 0 ? 'never' : p >= 0.9995 ? 'every roll' : `1 in ${fmt(1 / p)}`);

function duration(rolls: number): string {
  if (!Number.isFinite(rolls)) return 'never';
  const hours = rolls / ROLLS_PER_HOUR;
  if (hours < 1 / 60) return `${Math.max(1, Math.round(hours * 3600))}s`;
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${fmt(hours)}h`;
}

// Every outcome's XP, with its weight in six-digit-roll units.
const { weights, offsets, items } = enumerateOutcomes(defs);
const xpById = badges.map((b) => b.xp);
const outcomeXp = new Float64Array(weights.length);
for (let r = 0; r < weights.length; r++) {
  let total = 0;
  for (let j = offsets[r]!; j < offsets[r + 1]!; j++) total += xpById[items[j]!]!;
  outcomeXp[r] = total;
}
const band = new Float64Array(RARITIES.length);
let meanXp = 0;
for (let r = 0; r < weights.length; r++) {
  band[rarityIndexForXp(outcomeXp[r]!)]! += weights[r]!;
  meanXp += outcomeXp[r]! * weights[r]!;
}
meanXp /= ROLL_OUTCOMES;
const order = Array.from(outcomeXp.keys()).sort((a, b) => outcomeXp[a]! - outcomeXp[b]!);
function xpQuantile(q: number): number {
  let seen = 0;
  for (const r of order) {
    seen += weights[r]!;
    if (seen >= q * ROLL_OUTCOMES) return outcomeXp[r]!;
  }
  return outcomeXp[order.at(-1)!]!;
}

console.log(`\n## Roll rarity (exact, ${ROLLS_PER_SECOND} rolls/s ≈ ${fmt(ROLLS_PER_HOUR)} rolls/hour)\n`);
console.log(`XP curve (1 in N → XP): ${curve.points.map(([n, x]) => `${fmt(n)} → ${fmt(x)}`).join(', ')}\n`);
console.log('| Rarity | Roll XP | Exactly this | This or better | Typical wait | Seen in an hour |');
console.log('|---|---:|---:|---:|---:|---:|');
let atLeast = 0;
const rows: string[] = [];
for (let i = RARITIES.length - 1; i >= 0; i--) {
  atLeast += band[i]!;
  const p = Math.min(1, atLeast / ROLL_OUTCOMES);
  const hour = -Math.expm1(ROLLS_PER_HOUR * Math.log1p(-Math.min(p, 1 - 1e-12)));
  rows.unshift(
    `| ${RARITIES[i]!.name} | ${fmt(RARITIES[i]!.minXp)} | ${oneIn(band[i]! / ROLL_OUTCOMES)} | ${oneIn(p)} | ${duration(1 / p)} | ${(hour * 100).toFixed(hour < 0.01 ? 3 : 1)}% |`,
  );
}
for (const row of rows) console.log(row);
console.log(`\nAverage roll: ${fmt(meanXp)} XP. Median roll: ${fmt(xpQuantile(0.5))} XP. 1 roll in 10 beats ${fmt(xpQuantile(0.9))} XP; 1 in 100 beats ${fmt(xpQuantile(0.99))} XP.`);

const famous = ['000007', '210074', '670007', '676767', '696969', '551267', '123456', '000000', '1000000', '(skip)000000', '(skip)(skip)(skip)(skip)(skip)(skip)(skip)'];
console.log('\n## Famous rolls\n');
console.log('| Roll | Badges | Best badge | Roll XP | Rarity |');
console.log('|---|---:|---|---:|---|');
for (const text of famous) {
  const roll = parseRoll(text)!;
  const earned = registry.detectorInstance.detect(roll).map((id) => registry.get(id)!);
  const xp = rollXp(earned);
  const best = earned.reduce((a, b) => (b.xp > a.xp ? b : a), earned[0]!);
  console.log(`| ${text} | ${earned.length} | ${best?.name ?? '—'} | ${fmt(xp)} | ${RARITIES[rarityIndexForXp(xp)]!.name} |`);
}

console.log('\n## Badge XP by tier\n');
console.log('| Tier | Badges | XP each |');
console.log('|---|---:|---:|');
for (const tier of BADGE_TIERS) {
  const xps = badges.filter((b) => b.tier === tier.id).map((b) => b.xp);
  if (!xps.length) continue;
  const lo = Math.min(...xps);
  const hi = Math.max(...xps);
  console.log(`| ${tier.name} | ${xps.length} | ${lo === hi ? fmt(lo) : `${fmt(lo)}–${fmt(hi)}`} |`);
}

const samples = ['ref.bond', 'ref.bond.ends', 'ref.bond.only', 'funny.21-start', 'math.equation', 'funny.676767', 'special.the-million', 'special.skip-7'];
console.log('\n## Sample badges\n');
console.log('| Badge | Odds | XP | Tier |');
console.log('|---|---:|---:|---|');
for (const id of samples) {
  const b = registry.get(id)!;
  console.log(`| ${b.name} | 1 in ${fmt(1 / b.probability)} | ${fmt(b.xp)} | ${BADGE_TIERS.find((t) => t.id === b.tier)!.name} |`);
}

if (args.includes('--verify')) {
  const rolls = 1_000_000;
  const seen = new Float64Array(RARITIES.length);
  const rng = seededRandom(20261023);
  for (let i = 0; i < rolls; i++) {
    const earned = registry.detectorInstance.detect(rollNumber(rng));
    let xp = 0;
    for (const id of earned) xp += registry.get(id)!.xp;
    seen[rarityIndexForXp(xp)]!++;
  }
  console.log(`\n## Verification: ${fmt(rolls)} real rolls\n`);
  console.log('| Rarity | Expected | Rolled |');
  console.log('|---|---:|---:|');
  RARITIES.forEach((r, i) => console.log(`| ${r.name} | ${fmt((band[i]! / ROLL_OUTCOMES) * rolls)} | ${fmt(seen[i]!)} |`));
}
