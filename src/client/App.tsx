import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { BadgesCollected } from './components/BadgesCollected';
import { IconGrid, IconTrophy, IconUser } from './components/Icons';
import { LeaderboardSheet } from './components/LeaderboardSheet';
import { RarityPanel, RecentRolls, StatsPanel } from './components/Panels';
import { ProfileSheet } from './components/ProfileSheet';
import { RollStage } from './components/RollStage';
import { CollectionSheet } from './components/CollectionSheet';
import { rarityIndexForXp, rarityForXp, RARITIES } from '../shared/progression';
import { BADGE_TIERS, rarity, rarityPaint, tier, useSystemReducedMotion } from './format';
import { loadMotion, saveMotion, type MotionPreference } from './storage';
import { useGame } from './useGame';

interface RankUp {
  key: number;
  from: string;
  to: string;
}

type View = 'play' | 'collection' | 'leaderboards' | 'profile';

export function App() {
  const { state, roll, rename, restore, retry, clearNotice } = useGame();
  const [view, setView] = useState<View>('play');
  const [motion, setMotion] = useState<MotionPreference>(loadMotion);
  const systemReduced = useSystemReducedMotion();
  const reducedMotion = motion === 'reduced' || (motion === 'system' && systemReduced);
  const [landedId, setLandedId] = useState<string | null>(null);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ id: string; shown: number } | null>(null);
  const onProgress = useCallback((id: string, shown: number) => setProgress({ id, shown }), []);

  const { current, history, rolling, catalog } = state;
  const currentLanded = current !== null && landedId === current.id;
  // While a new roll spins (or lands), keep the previous result on screen, fully revealed.
  const shownRoll = currentLanded ? current : rolling ? current : (history[0] ?? null);
  const columnMode = currentLanded && !rolling ? 'animate' : shownRoll ? 'instant' : 'wait';

  // XP, rarity and collection count tick up as each new badge is revealed rather
  // than the moment the server answers, so the panels never spoil the reveal.
  const pending = useMemo(() => {
    if (!current || revealedId === current.id) return { xp: 0, badges: 0 };
    const shown = progress?.id === current.id ? progress.shown : 0;
    const hidden = current.badges.slice(shown).filter((b) => b.isNew);
    return { xp: hidden.reduce((sum, b) => sum + b.xp, 0), badges: hidden.length };
  }, [current, revealedId, progress]);
  const player = useMemo(() => {
    if (!state.player) return null;
    const xp = state.player.xp - pending.xp;
    return { ...state.player, xp, uniqueBadges: state.player.uniqueBadges - pending.badges, rarity: rarityForXp(xp).id };
  }, [state.player, pending]);
  const best = current && current.bestImproved && revealedId !== current.id ? state.bestBefore : state.best;

  // One toast at a time; climbing several ranks in one reveal widens it ("from Rare" → "Exotic").
  const [toast, setToast] = useState<RankUp | null>(null);
  const lastRank = useRef<{ playerId: number; index: number } | null>(null);
  useEffect(() => {
    if (!player) return;
    const index = rarityIndexForXp(player.xp);
    const last = lastRank.current;
    if (last && last.playerId === player.id && index > last.index) {
      const from = RARITIES[last.index]!.id;
      setToast((t) => ({ key: Date.now(), from: t?.from ?? from, to: RARITIES[index]!.id }));
    }
    lastRank.current = { playerId: player.id, index };
  }, [player]);
  const dismissToast = useCallback(() => setToast(null), []);

  const glow = useMemo(() => {
    if (!current || revealedId !== current.id || current.badges.length === 0) return null;
    const best = tier(current.badges.at(-1)!.tier);
    const index = BADGE_TIERS.findIndex((t) => t.id === best.id);
    if (index < 3) return null;
    return { color: best.color, strength: Math.min(1, (index - 2) / 6) };
  }, [current, revealedId]);

  const onRoll = useCallback(() => {
    if (view === 'play') void roll();
  }, [roll, view]);

  // Space / Enter rolls, unless you're typing or a sheet is open.
  const rollRef = useRef(onRoll);
  rollRef.current = onRoll;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key !== ' ' && e.key !== 'Enter') return;
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, button, summary, a, [role="dialog"]')) return;
      e.preventDefault();
      rollRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const changeMotion = (m: MotionPreference) => {
    setMotion(m);
    saveMotion(m);
  };

  if (state.phase === 'loading') {
    return (
      <div className="splash">
        <h1 className="logo">RNG BADGES</h1>
        <p className="muted">Connecting…</p>
      </div>
    );
  }
  if (state.phase === 'error' || !player || !catalog) {
    return (
      <div className="splash">
        <h1 className="logo">RNG BADGES</h1>
        <p className="notice">{state.error ?? 'Something went wrong.'}</p>
        <button type="button" className="button-primary" onClick={retry}>
          Try again
        </button>
      </div>
    );
  }

  const r = rarity(player.rarity);
  return (
    <div
      className="app"
      data-motion={reducedMotion ? 'reduced' : 'full'}
      style={{ '--rarity': r.color, '--rarity-paint': rarityPaint(r) } as CSSProperties}
    >
      <header className="topbar">
        <h1 className="logo">RNG BADGES</h1>
        <nav className="nav" aria-label="Main">
          <button type="button" className="nav-button" onClick={() => setView('collection')}>
            <IconGrid />
            <span>Collection</span>
          </button>
          <button type="button" className="nav-button" onClick={() => setView('leaderboards')}>
            <IconTrophy />
            <span>Leaderboards</span>
          </button>
          <button type="button" className="nav-button nav-player" onClick={() => setView('profile')} aria-label={`Profile: ${player.username}`}>
            <IconUser />
            <span>{player.username}</span>
          </button>
        </nav>
      </header>

      <main className="layout">
        <div className="play">
          <RarityPanel player={player} />
          <RollStage
            roll={current?.roll ?? null}
            rollId={current?.id ?? null}
            rolling={rolling}
            reducedMotion={reducedMotion}
            glow={glow}
            onLanded={setLandedId}
          />
          <div className="roll-row">
            <button type="button" className="roll-button" onClick={onRoll} disabled={rolling} aria-keyshortcuts="Space">
              {rolling ? 'Rolling…' : 'Roll'}
            </button>
            <p className="roll-hint" aria-hidden>
              Space to roll · 1 in 1,000,001 for anything specific
            </p>
          </div>
          {state.notice && (
            <p className="notice" role="alert">
              {state.notice}{' '}
              <button type="button" className="link" onClick={clearNotice}>
                Dismiss
              </button>
            </p>
          )}
          <BadgesCollected
            key={shownRoll?.id ?? 'none'}
            roll={shownRoll}
            mode={columnMode}
            reducedMotion={reducedMotion}
            onComplete={setRevealedId}
            onProgress={onProgress}
          />
        </div>
        <aside className="side">
          <StatsPanel player={player} totalBadges={catalog.badges.length} best={best} onOpenCollection={() => setView('collection')} />
          <RecentRolls history={history} />
        </aside>
      </main>

      <footer className="footer">
        <p>
          Rolls happen on the server: one draw from 000000–999999 or the seven-digit 1000000, all 1,000,001 equally likely.{' '}
          <button type="button" className="link" onClick={() => setView('leaderboards')}>
            See who’s on top →
          </button>
        </p>
      </footer>

      <RankUpToast toast={toast} onDismiss={dismissToast} />

      {view === 'collection' && (
        <CollectionSheet catalog={catalog} player={player} discoveries={state.discoveries} revealed={state.revealed} onClose={() => setView('play')} />
      )}
      {view === 'leaderboards' && <LeaderboardSheet token={state.token} onClose={() => setView('play')} />}
      {view === 'profile' && state.token && (
        <ProfileSheet
          player={player}
          token={state.token}
          motion={motion}
          onMotion={changeMotion}
          onRename={rename}
          onRestore={restore}
          onClose={() => setView('play')}
        />
      )}
    </div>
  );
}

function RankUpToast({ toast, onDismiss }: { toast: RankUp | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(onDismiss, 3600);
    return () => window.clearTimeout(t);
  }, [toast, onDismiss]);
  if (!toast) return null;
  const to = rarity(toast.to);
  const from = rarity(toast.from);
  return (
    <div key={toast.key} className="toast" role="status" style={{ '--rarity-paint': rarityPaint(to), '--rarity': to.color } as CSSProperties}>
      <p className="toast-kicker">Rank up</p>
      <p className="toast-title">{to.name}</p>
      <p className="toast-sub">from {from.name}</p>
      <button type="button" className="icon-button toast-close" onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
