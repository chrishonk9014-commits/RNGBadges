/**
 * Badge XP and badge tiers.
 *
 * A badge's XP comes from how rare it is. The curve is a set of anchor points
 * (odds "1 in N" → XP) joined by straight lines on a log-log scale, so XP
 * rises smoothly with rarity. Its shape was tuned with `npm run balance` (see
 * BALANCE.md): cheap badges carry the first few ranks, one-in-a-million badges
 * carry the long game. Any badge can override its XP in its definition.
 */
export const XP_CURVE = {
  points: [
    [1, 5],
    [200, 5],
    [1_000, 10],
    [10_000, 30],
    [100_000, 300],
    [1_000_000, 16_500],
    [10_000_000, 150_000],
    [1_000_000_000, 1_000_000],
  ] as Array<[odds: number, xp: number]>,
  minXp: 5,
  maxXp: 1_000_000,
};

export type XpCurve = typeof XP_CURVE;

export interface BadgeTier {
  id: string;
  name: string;
  /** A badge belongs to the rarest tier whose minOdds ("1 in N") it meets. */
  minOdds: number;
  color: string;
}

/**
 * Badge rarity tiers, by odds. Names follow the reward table in the design
 * brief; XP comes from XP_CURVE rather than a flat amount per tier, so two
 * badges in one tier pay more the rarer each one actually is.
 */
export const BADGE_TIERS: readonly BadgeTier[] = [
  { id: 'common', name: 'Common', minOdds: 1, color: '#9aa3b2' },
  { id: 'uncommon', name: 'Uncommon', minOdds: 50, color: '#5fd38d' },
  { id: 'recognizable', name: 'Recognizable', minOdds: 300, color: '#3fc1c9' },
  { id: 'unusual', name: 'Unusual', minOdds: 2_000, color: '#4f9dff' },
  { id: 'rare', name: 'Rare', minOdds: 8_000, color: '#7a6cff' },
  { id: 'very-rare', name: 'Very Rare', minOdds: 30_000, color: '#b65cff' },
  { id: 'extremely-rare', name: 'Extremely Rare', minOdds: 200_000, color: '#ff5cc8' },
  { id: 'legendary', name: 'Legendary', minOdds: 900_000, color: '#ffae34' },
  { id: 'special-secret', name: 'Special Secret', minOdds: 5_000_000, color: '#ff4d4d' },
];

/** Rounds to friendly numbers: multiples of 5 below 100, two significant figures above. */
export function roundXp(x: number): number {
  if (x < 100) return Math.round(x / 5) * 5;
  const step = 10 ** (Math.floor(Math.log10(x)) - 1);
  return Math.round(x / step) * step;
}

export function rawXpForOdds(odds: number, curve: XpCurve = XP_CURVE): number {
  const pts = curve.points;
  if (odds <= pts[0]![0]) return pts[0]![1];
  for (let i = 1; i < pts.length; i++) {
    const [n1, x1] = pts[i]!;
    if (odds <= n1) {
      const [n0, x0] = pts[i - 1]!;
      const t = Math.log(odds / n0) / Math.log(n1 / n0);
      return x0 * (x1 / x0) ** t;
    }
  }
  return pts[pts.length - 1]![1];
}

export function xpForProbability(probability: number, curve: XpCurve = XP_CURVE): number {
  if (!(probability > 0)) throw new RangeError(`probability must be > 0, got ${probability}`);
  const raw = rawXpForOdds(1 / probability, curve);
  return Math.min(curve.maxXp, Math.max(curve.minXp, roundXp(raw)));
}

export function tierForProbability(probability: number): BadgeTier {
  const odds = 1 / probability;
  let tier = BADGE_TIERS[0]!;
  for (const t of BADGE_TIERS) if (odds >= t.minOdds) tier = t;
  return tier;
}

export function tierById(id: string): BadgeTier {
  return BADGE_TIERS.find((t) => t.id === id) ?? BADGE_TIERS[0]!;
}
