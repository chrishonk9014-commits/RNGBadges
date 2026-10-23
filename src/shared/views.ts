/** How badges and rolls are presented to players, shared by the server and the in-browser game. */
import type { BadgeView, RollView } from './api';
import type { CatalogBadge } from './badges/registry';
import { formatRoll, rollCells, type Roll } from './roll';

/** A badge as a player sees it. Hidden badges they haven't found keep their name and text secret. */
export function badgeView(b: CatalogBadge, revealed: boolean): BadgeView {
  if (revealed) return { ...b, revealed: true };
  return {
    id: b.id,
    name: '???',
    description: 'A secret badge. Keep rolling.',
    category: b.category,
    family: b.family,
    hidden: true,
    revealed: false,
    probability: b.probability,
    xp: b.xp,
    tier: b.tier,
  };
}

export function rollView(roll: Roll): RollView {
  return { text: formatRoll(roll), digits: roll.digits, skips: roll.skips, seven: roll.seven, cells: rollCells(roll) };
}
