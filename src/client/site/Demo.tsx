import { useCallback, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { PlayerSummary, RollResponse } from '../../shared/api';
import { rarityForXp } from '../../shared/progression';
import { rollNumber, type Roll } from '../../shared/roll';
import { BadgesCollected } from '../components/BadgesCollected';
import { RollRarityPanel, type RollPanelStatus } from '../components/Panels';
import { RollStage } from '../components/RollStage';
import { formatNumber, formatOdds, tier } from '../format';
import { badgesFor, browserRandom, buildRollResponse, localNow, readNumber } from './engine';

/** A playable copy of the roll screen, using the same components and badge engine as the game. */
export function DemoRoller({ reducedMotion }: { reducedMotion: boolean }) {
  const [current, setCurrent] = useState<RollResponse | null>(null);
  const [previous, setPrevious] = useState<RollResponse | null>(null);
  const [rolling, setRolling] = useState(false);
  const [landedId, setLandedId] = useState<string | null>(null);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ id: string; shown: number } | null>(null);
  const session = useRef({ rolls: 0, bestXp: 0, owned: new Set<string>(), last: null as Roll | null, current: null as RollResponse | null });
  const onProgress = useCallback((id: string, shown: number) => setProgress({ id, shown }), []);

  const roll = useCallback(() => {
    if (rolling) return;
    setRolling(true);
    // A short pause stands in for the server round trip, so the digits get a moment to spin.
    window.setTimeout(() => {
      const s = session.current;
      const r = rollNumber(browserRandom);
      const number = s.rolls + 1;
      const badges = badgesFor(r, { previous: s.last, rollNumber: number, local: localNow() });
      const player: PlayerSummary = {
        id: 0,
        username: 'demo',
        rolls: number,
        uniqueBadges: s.owned.size,
        bestXp: s.bestXp,
        bestRarity: rarityForXp(s.bestXp).id,
      };
      const res = buildRollResponse(`demo-${number}`, number, r, badges, s.owned, player);
      s.rolls = number;
      s.last = r;
      s.bestXp = Math.max(s.bestXp, res.xp);
      for (const b of badges) s.owned.add(b.id);
      setPrevious(s.current);
      setCurrent(res);
      s.current = res;
      setRolling(false);
    }, 120);
  }, [rolling]);

  const s = session.current;
  const landed = current !== null && landedId === current.id;
  const shown = landed ? current : rolling ? current : previous;
  const mode = landed && !rolling ? 'animate' : shown ? 'instant' : 'wait';
  // Same as the game: the panel resets while the number spins, then climbs with the reveal.
  let panelXp = 0;
  let status: RollPanelStatus = 'idle';
  if (rolling || (current && !landed)) status = 'rolling';
  else if (current && revealedId === current.id) {
    panelXp = current.xp;
    status = 'final';
  } else if (current) {
    const count = progress?.id === current.id ? progress.shown : 0;
    panelXp = current.badges.slice(0, count).reduce((sum, b) => sum + b.xp, 0);
    status = 'counting';
  }
  const bestRarity = rarityForXp(s.bestXp);

  return (
    <div className="demo-console">
      <RollRarityPanel xp={panelXp} status={status} />
      <RollStage roll={current?.roll ?? null} rollId={current?.id ?? null} rolling={rolling} reducedMotion={reducedMotion} glow={null} onLanded={setLandedId} />
      <div className="roll-row">
        <button type="button" className="roll-button" onClick={roll} disabled={rolling}>
          {rolling ? 'Rolling…' : 'Roll'}
        </button>
        <p className="demo-session">
          Demo: {formatNumber(s.rolls)} roll{s.rolls === 1 ? '' : 's'}
          {s.rolls > 0 && (
            <>
              {' '}
              · best <span style={{ color: bestRarity.color }}>{bestRarity.name}</span> ({formatNumber(s.bestXp)} XP)
            </>
          )}{' '}
          · not saved
        </p>
      </div>
      <BadgesCollected key={shown?.id ?? 'none'} roll={shown} mode={mode} reducedMotion={reducedMotion} onComplete={setRevealedId} onProgress={onProgress} />
    </div>
  );
}

/** Type any number and see every badge it would earn. */
export function NumberChecker() {
  const [input, setInput] = useState('551267');
  const roll = useMemo(() => readNumber(input), [input]);
  const badges = useMemo(() => (roll ? badgesFor(roll).reverse() : []), [roll]);
  const xp = badges.reduce((sum, b) => sum + b.xp, 0);

  return (
    <div className="checker">
      <label htmlFor="check-number" className="checker-label">
        Check any number
      </label>
      <input
        id="check-number"
        className="checker-input"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        maxLength={60}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        aria-describedby="check-help"
      />
      <p id="check-help" className="checker-help">
        Up to six digits (7 means 000007), or 1000000.
      </p>
      {!roll && input.trim() !== '' && <p className="checker-empty">That isn't a roll the game can produce. Try six digits, like 000420.</p>}
      {roll && (
        <>
          <p className="checker-summary" aria-live="polite">
            <strong>{badges.length}</strong> badge{badges.length === 1 ? '' : 's'} · <strong>{formatNumber(xp)} XP</strong> ·{' '}
            <strong style={{ color: rarityForXp(xp).color }}>{rarityForXp(xp).name}</strong> roll
          </p>
          {badges.length === 0 ? (
            <p className="checker-empty">Nothing here. About one roll in seventeen earns no badges at all.</p>
          ) : (
            <ul className="checker-list">
              {badges.map((b) => {
                const t = tier(b.tier);
                return (
                  <li key={b.id} style={{ '--tier': t.color } as CSSProperties}>
                    <span className="checker-name">{b.hidden ? '???' : b.name}</span>
                    <span className="checker-tier">{t.name}</span>
                    <span className="checker-odds">{formatOdds(b.probability)}</span>
                    <span className="checker-xp">{formatNumber(b.xp)} XP</span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="checker-note">Secret badges stay hidden here too. Badges about your previous roll or the clock only appear in real rolls.</p>
        </>
      )}
    </div>
  );
}
