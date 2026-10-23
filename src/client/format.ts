import { useEffect, useState } from 'react';
import { BADGE_TIERS, tierById, type BadgeTier } from '../shared/xp';
import { RARITIES, rarityById, type Rarity } from '../shared/progression';
import type { CategoryId } from '../shared/badges/types';

const nf = new Intl.NumberFormat('en-US');
export const formatNumber = (n: number): string => nf.format(Math.round(n));

/** "1 in 1,000,001", compact for huge odds. */
export function formatOdds(probability: number): string {
  const odds = 1 / probability;
  if (odds >= 1e9) return `1 in ${(odds / 1e9).toLocaleString('en-US', { maximumFractionDigits: 1 })} billion`;
  if (odds >= 1e7) return `1 in ${(odds / 1e6).toLocaleString('en-US', { maximumFractionDigits: 0 })} million`;
  return `1 in ${formatNumber(odds)}`;
}

export function formatXp(xp: number): string {
  return `${formatNumber(xp)} XP`;
}

export const tier = (id: string): BadgeTier => tierById(id);
export const rarity = (id: string): Rarity => rarityById(id);
export { BADGE_TIERS, RARITIES };

export const CATEGORY_NAMES: Record<CategoryId, string> = {
  funny: 'Funny Numbers',
  reference: 'References',
  history: 'History',
  science: 'Science & Math Constants',
  calculator: 'Calculator Words',
  phoneword: 'Phone Words',
  math: 'Math',
  poker: 'Poker Digits',
  pattern: 'Patterns',
  calendar: 'Calendar & Clock',
  special: 'Special',
  meta: 'Meta',
};

/** CSS background for a rarity: flat colour, or a gradient at the top of the ladder. */
export function rarityPaint(r: Rarity): string {
  return r.accent ? `linear-gradient(90deg, ${r.color}, ${r.accent})` : r.color;
}

export function timeAgo(ms: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Tracks the OS reduced-motion setting. */
export function useSystemReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(query).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}
