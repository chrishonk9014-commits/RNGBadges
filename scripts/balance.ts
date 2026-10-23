/**
 * Balance report: how long the rarity ladder takes with the current badges,
 * odds, XP curve and thresholds.
 *
 *   npm run balance                       # report
 *   npm run balance -- --curve "1:5,100:5,1000:15,…"   # try a different curve
 *   npm run balance -- --verify           # also play real rolls through the detector
 *
 * Each simulated player draws the roll on which they first find every badge
 * (geometric with the badge's exact odds), which is equivalent to rolling
 * until every badge is found but takes milliseconds. --verify cross-checks a
 * handful of players with real rolls.
 */
import { allBadgeDefs } from '../src/shared/badges/catalog/index';
import oddsJson from '../src/shared/badges/odds.json';
import { BadgeRegistry, type CatalogBadge } from '../src/shared/badges/registry';
import { RARITIES } from '../src/shared/progression';
import { rollNumber } from '../src/shared/roll';
import { seededRandom } from '../src/shared/rng';
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
const PLAYERS = Number(flag('players') ?? 3000);
/** Sustained rolls per second for an active player clicking steadily. */
const ROLLS_PER_SECOND = Number(flag('rate') ?? 2);
const ROLLS_PER_HOUR = ROLLS_PER_SECOND * 3600;

const registry = new BadgeRegistry(allBadgeDefs(), oddsJson as Record<string, number>, curve);
const badges = registry.badges;
const rng = seededRandom(20261023);
const uniform = (): number => (rng.int(2 ** 30) + 0.5) / 2 ** 30;

function discoveryRoll(b: CatalogBadge): number {
  return Math.ceil(Math.log(uniform()) / Math.log1p(-b.probability));
}

function simulatePlayer(): number[] {
  const finds = badges.map((b) => ({ at: discoveryRoll(b), xp: b.xp })).sort((a, b) => a.at - b.at);
  const reach: number[] = [];
  let xp = 0;
  let r = 0;
  for (const f of finds) {
    xp += f.xp;
    while (r < RARITIES.length && xp >= RARITIES[r]!.minXp) reach[r++] = r === 0 ? 0 : f.at;
  }
  while (r < RARITIES.length) reach[r++] = Infinity;
  return reach;
}

const quantile = (sorted: number[], q: number): number => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;

function duration(rolls: number): string {
  if (!Number.isFinite(rolls)) return 'never';
  const hours = rolls / ROLLS_PER_HOUR;
  if (hours < 1 / 60) return `${Math.max(1, Math.round(hours * 3600))}s`;
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${Math.round(hours)}h`;
}

const fmt = (n: number): string => (Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : '—');

const runs = Array.from({ length: PLAYERS }, simulatePlayer);
console.log(`\n## Pacing (${PLAYERS} simulated players, ${ROLLS_PER_SECOND} rolls/s ≈ ${fmt(ROLLS_PER_HOUR)} rolls/hour)\n`);
console.log(`XP curve (1 in N → XP): ${curve.points.map(([n, x]) => `${fmt(n)} → ${fmt(x)}`).join(', ')}\n`);
console.log('| Rarity | XP | Lucky 10% | Median | Unlucky 90% | Reached within 10M rolls |');
console.log('|---|---:|---:|---:|---:|---:|');
RARITIES.forEach((rarity, i) => {
  const times = runs.map((r) => r[i]!).sort((a, b) => a - b);
  const reached = times.filter((t) => t <= 10_000_000).length / times.length;
  const cell = (q: number): string => {
    const t = quantile(times, q);
    return Number.isFinite(t) ? `${fmt(t)} rolls (${duration(t)})` : 'never';
  };
  console.log(`| ${rarity.name} | ${fmt(rarity.minXp)} | ${cell(0.1)} | ${cell(0.5)} | ${cell(0.9)} | ${(reached * 100).toFixed(1)}% |`);
});

console.log('\n## Expected XP by rolls\n');
console.log('| Rolls | Time | Expected XP | Badges found |');
console.log('|---:|---:|---:|---:|');
for (const rolls of [10, 100, 1_000, 10_000, 100_000, 1_000_000, 10_000_000]) {
  let xp = 0;
  let found = 0;
  for (const b of badges) {
    const p = -Math.expm1(rolls * Math.log1p(-b.probability));
    xp += p * b.xp;
    found += p;
  }
  console.log(`| ${fmt(rolls)} | ${duration(rolls)} | ${fmt(xp)} | ${found.toFixed(0)} / ${badges.length} |`);
}

console.log('\n## XP pool by badge tier\n');
console.log('| Tier | Badges | XP each | Total XP |');
console.log('|---|---:|---:|---:|');
for (const tier of BADGE_TIERS) {
  const inTier = badges.filter((b) => b.tier === tier.id);
  if (!inTier.length) continue;
  const xps = inTier.map((b) => b.xp);
  const total = xps.reduce((a, b) => a + b, 0);
  const lo = Math.min(...xps);
  const hi = Math.max(...xps);
  console.log(`| ${tier.name} | ${inTier.length} | ${lo === hi ? fmt(lo) : `${fmt(lo)}–${fmt(hi)}`} | ${fmt(total)} |`);
}
const obtainable = badges.filter((b) => b.probability >= 1e-7).reduce((a, b) => a + b.xp, 0);
console.log(`\nTotal XP in the game: ${fmt(registry.totalXp)}. ${fmt(obtainable)} of it is in badges a dedicated player can find; ${fmt(registry.totalXp - obtainable)} sits in skip badges rarer than 1 in 10 million.`);

const samples = ['ref.bond', 'ref.bond.ends', 'ref.bond.only', 'funny.21-start', 'math.equation', 'funny.676767', 'special.the-million', 'special.skip-7'];
console.log('\n## Sample badges\n');
console.log('| Badge | Odds | XP | Tier |');
console.log('|---|---:|---:|---|');
for (const id of samples) {
  const b = registry.get(id)!;
  console.log(`| ${b.name} | 1 in ${fmt(1 / b.probability)} | ${fmt(b.xp)} | ${BADGE_TIERS.find((t) => t.id === b.tier)!.name} |`);
}

if (args.includes('--verify')) {
  const players = 6;
  const rolls = 200_000;
  const detector = registry.detectorInstance;
  console.log(`\n## Verification: ${players} players × ${fmt(rolls)} real rolls\n`);
  const checkpoints = [1_000, 10_000, 100_000, 200_000];
  const totals = checkpoints.map(() => 0);
  for (let p = 0; p < players; p++) {
    const own = new Set<string>();
    let xp = 0;
    const r = seededRandom(1000 + p);
    let c = 0;
    for (let i = 1; i <= rolls; i++) {
      for (const id of detector.detect(rollNumber(r))) {
        if (!own.has(id)) {
          own.add(id);
          xp += registry.get(id)!.xp;
        }
      }
      if (i === checkpoints[c]) totals[c++]! += xp;
    }
  }
  console.log('| Rolls | Mean XP (real rolls) |');
  console.log('|---:|---:|');
  checkpoints.forEach((cp, i) => console.log(`| ${fmt(cp)} | ${fmt(totals[i]! / players)} |`));
}
