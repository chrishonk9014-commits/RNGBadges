import { useEffect, useMemo, useRef, useState } from 'react';
import type { RollResponse } from '../../shared/api';
import { revealOffsets } from '../reveal';
import { formatNumber, rarity } from '../format';
import { BadgeCard } from './BadgeCard';

interface Props {
  roll: RollResponse | null;
  /** 'wait' before the number has landed, 'animate' to play the reveal, 'instant' to show everything. */
  mode: 'wait' | 'animate' | 'instant';
  reducedMotion: boolean;
  onComplete: (rollId: string) => void;
  /** Called whenever another badge becomes visible, so XP can tick up with the reveal. */
  onProgress: (rollId: string, shown: number) => void;
}

/**
 * The badges from the latest roll, revealed one at a time from worst to best.
 * The spotlight always shows the badge just revealed; it ends on the best.
 * Mount with `key={roll.id}` so every roll gets fresh reveal state — an
 * interrupted reveal can never leak into the next one.
 */
export function BadgesCollected({ roll, mode, reducedMotion, onComplete, onProgress }: Props) {
  const badges = roll?.badges ?? [];
  const count = badges.length;
  const offsets = useMemo(() => revealOffsets(count, reducedMotion), [count, reducedMotion]);
  const [shown, setShown] = useState(mode === 'instant' ? count : 0);
  const completed = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;

  useEffect(() => {
    if (roll) onProgressRef.current(roll.id, shown);
  }, [roll, shown]);

  useEffect(() => {
    if (!roll || mode === 'wait') return;
    const complete = () => {
      if (completed.current) return;
      completed.current = true;
      onCompleteRef.current(roll.id);
    };
    if (mode === 'instant') {
      setShown(count);
      complete();
      return;
    }
    const timers = offsets.map((ms, i) => window.setTimeout(() => setShown((s) => Math.max(s, i + 1)), ms));
    timers.push(window.setTimeout(complete, (offsets.at(-1) ?? 0) + 40));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [roll, mode, offsets, count]);

  const done = shown >= count;
  // Every badge counts toward the roll's XP, found before or not.
  const revealedXp = badges.slice(0, shown).reduce((sum, b) => sum + b.xp, 0);
  const newCount = badges.slice(0, shown).filter((b) => b.isNew).length;
  const spotlight = shown > 0 ? badges[shown - 1] : undefined;
  const earlier = badges.slice(0, Math.max(0, shown - 1)).reverse();

  return (
    <section className="collected" aria-labelledby="collected-title">
      <header className="collected-head">
        <h2 id="collected-title">Badges Collected</h2>
        {roll && count > 0 && (
          <p className="collected-sum">
            <span>
              {shown}/{count} badge{count === 1 ? '' : 's'}
            </span>
            <span className={`collected-xp${revealedXp > 0 ? ' has-xp' : ''}`}>{formatNumber(revealedXp)} XP</span>
            {newCount > 0 && <span className="collected-new">{newCount} new</span>}
          </p>
        )}
      </header>

      {!roll && <p className="collected-empty">Roll a number to see what's hiding inside it.</p>}
      {roll && count === 0 && mode !== 'wait' && (
        <p className="collected-empty">No badges this roll. The next one could be anything.</p>
      )}
      {roll && count > 0 && shown === 0 && <div className="badge-spot badge-spot-pending" aria-hidden />}
      {spotlight && <BadgeCard key={spotlight.id} badge={spotlight} isNew={spotlight.isNew} variant="spotlight" best={done} />}
      {earlier.length > 0 && (
        <ol className="badge-list" aria-label="Other badges from this roll, best first">
          {earlier.map((b) => (
            <BadgeCard key={b.id} badge={b} isNew={b.isNew} variant="row" />
          ))}
        </ol>
      )}

      <p className="sr-only" aria-live="polite">
        {roll && done && mode !== 'wait'
          ? count === 0
            ? `Rolled ${roll.roll.text}. No badges.`
            : `Rolled ${roll.roll.text}. ${count} badge${count === 1 ? '' : 's'}, best: ${badges[count - 1]!.name}. ${formatNumber(
                revealedXp,
              )} XP, a ${rarity(roll.rarity).name} roll.`
          : ''}
      </p>
    </section>
  );
}
