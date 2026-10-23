import type { CatalogBadge } from './badges/registry';

/**
 * Best Number Rolled score. A roll is worth the XP value of every badge it
 * triggers, whether or not the player already owned them, so the leaderboard
 * ranks how remarkable the number is — never how big it is. `topBadgeWeight`
 * and `otherBadgeWeight` let the standout badge count for more or less than
 * the supporting cast.
 */
export const SCORE_CONFIG = {
  topBadgeWeight: 1,
  otherBadgeWeight: 1,
  /** How many badges to show next to a leaderboard entry. */
  standoutCount: 3,
};

export function rollScore(badges: readonly Pick<CatalogBadge, 'xp'>[], config = SCORE_CONFIG): number {
  if (badges.length === 0) return 0;
  let top = 0;
  let total = 0;
  for (const b of badges) {
    total += b.xp;
    top = Math.max(top, b.xp);
  }
  return Math.round(top * config.topBadgeWeight + (total - top) * config.otherBadgeWeight);
}

/** The badges worth showing beside a roll, best first. */
export function standoutBadges<T extends Pick<CatalogBadge, 'xp' | 'probability'>>(badges: readonly T[], count = SCORE_CONFIG.standoutCount): T[] {
  return [...badges].sort((a, b) => b.xp - a.xp || a.probability - b.probability).slice(0, count);
}
