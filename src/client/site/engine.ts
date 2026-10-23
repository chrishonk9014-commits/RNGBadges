/**
 * The real badge engine, running in the browser for the website's demo and
 * number checker. Demo rolls are drawn here, so they are never saved and
 * never reach the leaderboards; the full game rolls on the server.
 */
import type { AwardedBadge, BadgeView, RollResponse, RollView } from '../../shared/api';
import { compareBadgeQuality, getRegistry, type CatalogBadge } from '../../shared/badges/registry';
import type { LocalTime, RollContext } from '../../shared/badges/types';
import type { RandomSource } from '../../shared/rng';
import { formatRoll, normalRoll, parseRoll, rollCells, sevenDigitRoll, type Roll } from '../../shared/roll';
import { rarityForXp } from '../../shared/progression';
import { rollXp } from '../../shared/scoring';

export const registry = getRegistry();

/** Uniform integers from the browser's cryptographic RNG, without modulo bias. */
export const browserRandom: RandomSource = {
  int(maxExclusive: number): number {
    const limit = Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive;
    const buf = new Uint32Array(1);
    do crypto.getRandomValues(buf);
    while (buf[0]! >= limit);
    return buf[0]! % maxExclusive;
  },
};

export function localNow(): LocalTime {
  const d = new Date();
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    hour: d.getHours(),
    minute: d.getMinutes(),
    second: d.getSeconds(),
  };
}

/** Every badge a roll earns, worst first. */
export function badgesFor(roll: Roll, ctx?: RollContext): CatalogBadge[] {
  return registry.detectorInstance
    .detect(roll, ctx)
    .map((id) => registry.get(id)!)
    .sort(compareBadgeQuality);
}

export function view(b: CatalogBadge): BadgeView {
  return { ...b, revealed: true };
}

export function rollView(roll: Roll): RollView {
  return { text: formatRoll(roll), digits: roll.digits, skips: roll.skips, seven: roll.seven, cells: rollCells(roll) };
}

/**
 * Reads what someone typed into the number checker: up to six digits (padded
 * with leading zeros), 1000000, or 1000000 with leading (skip) markers.
 */
export function readNumber(input: string): Roll | null {
  const text = input.trim().toLowerCase().replace(/\s+/g, '');
  if (text.startsWith('(skip)')) return parseRoll(text);
  if (text === '1000000') return sevenDigitRoll(0);
  if (!/^\d{1,6}$/.test(text)) return null;
  return normalRoll(Number(text));
}

export function buildRollResponse(
  id: string,
  rollNumber: number,
  roll: Roll,
  badges: CatalogBadge[],
  owned: ReadonlySet<string>,
  player: RollResponse['player'],
): RollResponse {
  const awarded: AwardedBadge[] = badges.map((b) => ({ ...view(b), isNew: !owned.has(b.id) }));
  const xp = rollXp(badges);
  return {
    id,
    rollNumber,
    roll: rollView(roll),
    badges: awarded,
    xp,
    rarity: rarityForXp(xp).id,
    bestImproved: xp > player.bestXp,
    player,
  };
}

/** Builds the lazily computed number-theory tables while the page is idle, so the first demo roll is instant. */
export function warmUp(): void {
  const run = () => registry.detectorInstance.detect(normalRoll(0));
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 2000 });
  else setTimeout(run, 300);
}
