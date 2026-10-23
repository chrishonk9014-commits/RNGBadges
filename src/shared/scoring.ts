import type { CatalogBadge } from './badges/registry';
import { rarityForXp, type Rarity } from './progression';

/** How many badges to show next to a leaderboard entry. */
export const STANDOUT_COUNT = 3;

/**
 * A roll's XP: the XP of every badge the number earned, added together.
 * Found it before or not, every badge counts, every roll.
 */
export function rollXp(badges: readonly Pick<CatalogBadge, 'xp'>[]): number {
  let total = 0;
  for (const b of badges) total += b.xp;
  return total;
}

export function rollRarity(badges: readonly Pick<CatalogBadge, 'xp'>[]): Rarity {
  return rarityForXp(rollXp(badges));
}

/** The badges worth showing beside a roll, best first. */
export function standoutBadges<T extends Pick<CatalogBadge, 'xp' | 'probability'>>(badges: readonly T[], count = STANDOUT_COUNT): T[] {
  return [...badges].sort((a, b) => b.xp - a.xp || a.probability - b.probability).slice(0, count);
}
