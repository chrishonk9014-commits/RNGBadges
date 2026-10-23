/**
 * Timing for the Badges Collected reveal. Badges arrive sorted worst → best;
 * each one appears on its own beat, and the best badge gets a longer pause
 * before it lands so the roll builds to it. Long lists speed up so a roll with
 * thirty badges still finishes in about two seconds.
 */
export const REVEAL = {
  /** Total time budget spread across everything before the best badge. */
  budgetMs: 1200,
  minStepMs: 90,
  maxStepMs: 360,
  /** Extra anticipation before the best badge. */
  finalPauseMs: 380,
};

/** Milliseconds after the roll lands at which badge i becomes visible. */
export function revealOffsets(count: number, reducedMotion: boolean): number[] {
  if (count === 0) return [];
  if (reducedMotion || count === 1) return new Array(count).fill(0);
  const step = Math.max(REVEAL.minStepMs, Math.min(REVEAL.maxStepMs, REVEAL.budgetMs / (count - 1)));
  const offsets = Array.from({ length: count }, (_, i) => Math.round(i * step));
  offsets[count - 1] = Math.round((count - 2) * step + step + REVEAL.finalPauseMs);
  return offsets;
}

/** How many badges should be visible `elapsedMs` after the roll landed. */
export function shownAt(offsets: readonly number[], elapsedMs: number): number {
  let n = 0;
  while (n < offsets.length && offsets[n]! <= elapsedMs) n++;
  return n;
}
