/**
 * Player rarity ladder. Cumulative XP thresholds live here and nowhere else;
 * change them here and every screen, the server and the balance report follow.
 */
export interface Rarity {
  id: string;
  name: string;
  minXp: number;
  color: string;
  /** Optional second colour for a gradient treatment at the top of the ladder. */
  accent?: string;
}

export const RARITIES: readonly Rarity[] = [
  { id: 'common', name: 'Common', minXp: 0, color: '#9aa3b2' },
  { id: 'uncommon', name: 'Uncommon', minXp: 100, color: '#5fd38d' },
  { id: 'notable', name: 'Notable', minXp: 300, color: '#3fc1c9' },
  { id: 'rare', name: 'Rare', minXp: 750, color: '#4f9dff' },
  { id: 'epic', name: 'Epic', minXp: 1_500, color: '#8b6cff' },
  { id: 'legendary', name: 'Legendary', minXp: 3_000, color: '#ffae34' },
  { id: 'mythic', name: 'Mythic', minXp: 6_000, color: '#ff6b4a' },
  { id: 'exotic', name: 'Exotic', minXp: 12_000, color: '#ff4fa3' },
  { id: 'divine', name: 'Divine', minXp: 25_000, color: '#ffe066', accent: '#fff6c9' },
  { id: 'celestial', name: 'Celestial', minXp: 50_000, color: '#7fd8ff', accent: '#d6f3ff' },
  { id: 'transcendent', name: 'Transcendent', minXp: 100_000, color: '#c18cff', accent: '#7fd8ff' },
  { id: 'cosmic', name: 'Cosmic', minXp: 200_000, color: '#6f7bff', accent: '#ff6bd5' },
  { id: 'universal', name: 'Universal', minXp: 400_000, color: '#3be8b0', accent: '#5b8cff' },
  { id: 'omniversal', name: 'Omniversal', minXp: 800_000, color: '#ff8a3d', accent: '#ff3d77' },
  { id: 'unfathomable', name: 'Unfathomable', minXp: 1_600_000, color: '#e2e8ff', accent: '#8a5cff' },
  { id: 'infinite', name: 'INFINITE', minXp: 3_200_000, color: '#ffffff', accent: '#ff4df0' },
];

export interface RarityProgress {
  current: Rarity;
  next: Rarity | null;
  /** XP earned since reaching the current rarity. */
  intoLevel: number;
  /** XP the current level spans (0 at the top). */
  levelSpan: number;
  /** 0–1 progress towards the next rarity (1 at the top). */
  fraction: number;
}

export function rarityIndexForXp(xp: number, ladder: readonly Rarity[] = RARITIES): number {
  let index = 0;
  for (let i = 0; i < ladder.length; i++) if (xp >= ladder[i]!.minXp) index = i;
  return index;
}

export function rarityForXp(xp: number, ladder: readonly Rarity[] = RARITIES): Rarity {
  return ladder[rarityIndexForXp(xp, ladder)]!;
}

export function rarityProgress(xp: number, ladder: readonly Rarity[] = RARITIES): RarityProgress {
  const index = rarityIndexForXp(xp, ladder);
  const current = ladder[index]!;
  const next = ladder[index + 1] ?? null;
  if (!next) return { current, next, intoLevel: xp - current.minXp, levelSpan: 0, fraction: 1 };
  const levelSpan = next.minXp - current.minXp;
  const intoLevel = xp - current.minXp;
  return { current, next, intoLevel, levelSpan, fraction: Math.min(1, intoLevel / levelSpan) };
}

export function rarityById(id: string, ladder: readonly Rarity[] = RARITIES): Rarity {
  return ladder.find((r) => r.id === id) ?? ladder[0]!;
}
