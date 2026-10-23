import { allBadgeDefs } from './catalog/index';
import { BadgeDetector } from './detector';
import oddsJson from './odds.json';
import type { BadgeDef, CategoryId } from './types';
import { XP_CURVE, tierForProbability, xpForProbability, type XpCurve } from '../xp';

export interface CatalogBadge {
  id: string;
  name: string;
  description: string;
  flavor?: string;
  category: CategoryId;
  family?: string;
  hidden: boolean;
  /** Exact chance per roll. */
  probability: number;
  xp: number;
  tier: string;
}

/** Badge quality order: lower XP first, then more common first, then by name. Best badge sorts last. */
export function compareBadgeQuality(a: CatalogBadge, b: CatalogBadge): number {
  return a.xp - b.xp || b.probability - a.probability || a.name.localeCompare(b.name);
}

export class BadgeRegistry {
  readonly badges: readonly CatalogBadge[];
  readonly totalXp: number;
  private readonly byId: Map<string, CatalogBadge>;
  private readonly detector: BadgeDetector;

  constructor(defs: readonly BadgeDef[], odds: Record<string, number>, curve: XpCurve = XP_CURVE) {
    this.badges = defs.map((def) => {
      const probability = odds[def.id];
      if (probability === undefined || !(probability > 0)) {
        throw new Error(`No odds for badge ${def.id} — run \`npm run odds\` after changing badges.`);
      }
      const xp = def.xp ?? xpForProbability(probability, curve);
      return {
        id: def.id,
        name: def.name,
        description: def.description,
        flavor: def.flavor,
        category: def.category,
        family: def.family,
        hidden: def.hidden ?? false,
        probability,
        xp,
        tier: tierForProbability(probability).id,
      };
    });
    this.byId = new Map(this.badges.map((b) => [b.id, b]));
    this.totalXp = this.badges.reduce((sum, b) => sum + b.xp, 0);
    this.detector = new BadgeDetector(defs);
  }

  get(id: string): CatalogBadge | undefined {
    return this.byId.get(id);
  }

  get detectorInstance(): BadgeDetector {
    return this.detector;
  }
}

let defaultRegistry: BadgeRegistry | null = null;

/** The game's registry: every definition plus its generated odds. */
export function getRegistry(): BadgeRegistry {
  defaultRegistry ??= new BadgeRegistry(allBadgeDefs(), oddsJson as Record<string, number>);
  return defaultRegistry;
}
