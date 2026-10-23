/**
 * The real badge engine, running in the browser for the website's demo and
 * number checker. Demo rolls are drawn here and never saved.
 */
import type { AwardedBadge, RollResponse } from '../../shared/api';
import { compareBadgeQuality, getRegistry, type CatalogBadge } from '../../shared/badges/registry';
import type { LocalTime, RollContext } from '../../shared/badges/types';
import { normalRoll, parseRoll, sevenDigitRoll, type Roll } from '../../shared/roll';
import { rarityForXp } from '../../shared/progression';
import { rollXp } from '../../shared/scoring';
import { badgeView, rollView } from '../../shared/views';

export const registry = getRegistry();

export { webCryptoRandom as browserRandom } from '../../shared/rng';

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
  const awarded: AwardedBadge[] = badges.map((b) => ({ ...badgeView(b, true), isNew: !owned.has(b.id) }));
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
