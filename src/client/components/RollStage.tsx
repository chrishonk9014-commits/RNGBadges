import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { RollView } from '../../shared/api';
import { SEVEN_DIGIT_NUMBER } from '../../shared/roll';

type Cell = { kind: 'digit'; value: string; locked: boolean } | { kind: 'skip'; fresh: boolean };

const SPIN_MIN_MS = 240;
const SPIN_TICK_MS = 55;
const LOCK_STEP_MS = 45;
const SKIP_PAUSE_MS = 300;
const SKIP_STEP_MS = 260;

const randomDigit = () => String(Math.floor(Math.random() * 10));
const spinning = (n: number): Cell[] => Array.from({ length: n }, () => ({ kind: 'digit', value: randomDigit(), locked: false }));
const finalCells = (roll: RollView): Cell[] =>
  roll.cells.map((c) => (c.kind === 'skip' ? { kind: 'skip', fresh: false } : { kind: 'digit', value: c.digit, locked: true }));

interface Props {
  roll: RollView | null;
  rollId: string | null;
  rolling: boolean;
  reducedMotion: boolean;
  /** Tier colour to glow with once the reveal has finished. */
  glow: { color: string; strength: number } | null;
  onLanded: (rollId: string) => void;
}

/**
 * The big number. Digits spin while the server rolls, then lock in left to
 * right. When 1000000 comes up it lands in full first, then its skipped
 * digits peel away one at a time from the left — exactly the order the skip
 * mechanic decides them in.
 */
export function RollStage({ roll, rollId, rolling, reducedMotion, glow, onLanded }: Props) {
  const [cells, setCells] = useState<Cell[]>(() =>
    roll ? finalCells(roll) : Array.from({ length: 6 }, () => ({ kind: 'digit', value: '–', locked: true })),
  );
  const [phase, setPhase] = useState<'idle' | 'spinning' | 'landing' | 'landed'>(roll ? 'landed' : 'idle');
  const timers = useRef<number[]>([]);
  const spinStarted = useRef(0);
  const ticker = useRef<number | null>(null);
  const landedFor = useRef<string | null>(rollId);
  const onLandedRef = useRef(onLanded);
  onLandedRef.current = onLanded;

  const clearTimers = () => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
    if (ticker.current !== null) window.clearInterval(ticker.current);
    ticker.current = null;
  };
  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

  // Start spinning as soon as a roll is requested.
  useEffect(() => {
    if (!rolling || reducedMotion) return;
    clearTimers();
    spinStarted.current = performance.now();
    setPhase('spinning');
    setCells(spinning(6));
    ticker.current = window.setInterval(() => {
      setCells((prev) => prev.map((c) => (c.kind === 'digit' && !c.locked ? { ...c, value: randomDigit() } : c)));
    }, SPIN_TICK_MS);
  }, [rolling, reducedMotion]);

  // Land each new result.
  useEffect(() => {
    if (!roll || !rollId || landedFor.current === rollId) return;
    const id = rollId;
    const finish = () => {
      landedFor.current = id;
      setPhase('landed');
      onLandedRef.current(id);
    };
    if (reducedMotion) {
      clearTimers();
      setCells(finalCells(roll));
      finish();
      return;
    }
    const digits = roll.seven ? SEVEN_DIGIT_NUMBER : roll.digits;
    const wait = Math.max(0, SPIN_MIN_MS - (performance.now() - spinStarted.current));
    later(wait, () => {
      setPhase('landing');
      setCells((prev) => (prev.length === digits.length ? prev : spinning(digits.length)));
      [...digits].forEach((d, i) => {
        later(i * LOCK_STEP_MS, () =>
          setCells((prev) => {
            const next = [...prev];
            next[i] = { kind: 'digit', value: d, locked: true };
            return next;
          }),
        );
      });
      const locked = digits.length * LOCK_STEP_MS;
      if (roll.skips === 0) {
        later(locked, () => {
          if (ticker.current !== null) window.clearInterval(ticker.current);
          ticker.current = null;
          finish();
        });
        return;
      }
      later(locked, () => {
        if (ticker.current !== null) window.clearInterval(ticker.current);
        ticker.current = null;
      });
      for (let k = 0; k < roll.skips; k++) {
        later(locked + SKIP_PAUSE_MS + k * SKIP_STEP_MS, () =>
          setCells((prev) => {
            const next = [...prev];
            next[k] = { kind: 'skip', fresh: true };
            return next;
          }),
        );
      }
      later(locked + SKIP_PAUSE_MS + roll.skips * SKIP_STEP_MS, () => {
        setCells(finalCells(roll));
        finish();
      });
    });
  }, [roll, rollId, reducedMotion]);

  useEffect(() => clearTimers, []);

  const label = roll && phase === 'landed' ? `Rolled ${roll.text}` : rolling ? 'Rolling…' : 'Press Roll to roll a number';
  return (
    <div
      className={`stage stage-${phase}${roll?.seven ? ' stage-seven' : ''}${rolling ? ' stage-busy' : ''}`}
      style={glow ? ({ '--glow': glow.color, '--glow-strength': glow.strength } as CSSProperties) : undefined}
      data-glow={glow ? 'on' : 'off'}
    >
      <div className="stage-digits" role="img" aria-label={label}>
        {cells.map((c, i) =>
          c.kind === 'skip' ? (
            <span key={i} className={`cell cell-skip${c.fresh ? ' cell-fresh' : ''}`} aria-hidden>
              (skip)
            </span>
          ) : (
            <span key={i} className={`cell${c.locked ? ' cell-locked' : ''}`} aria-hidden>
              {c.value}
            </span>
          ),
        )}
      </div>
    </div>
  );
}
