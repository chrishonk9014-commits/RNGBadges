import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { BadgesCollected } from './components/BadgesCollected';
import { IconGrid, IconTrophy, IconUser } from './components/Icons';
import { LeaderboardSheet } from './components/LeaderboardSheet';
import { RecentRolls, RollRarityPanel, StatsPanel, type RollPanelStatus } from './components/Panels';
import { ProfileSheet } from './components/ProfileSheet';
import { RollStage } from './components/RollStage';
import { CollectionSheet } from './components/CollectionSheet';
import { rarityForXp, rarityIndexForXp } from '../shared/progression';
import { formatNumber, rarity, rarityPaint, useSystemReducedMotion } from './format';
import { loadMotion, saveMotion, type MotionPreference } from './storage';
import { useGame } from './useGame';

interface BestToast {
  key: string;
  roll: string;
  xp: number;
  rarity: string;
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

  // Each roll is scored on its own. The panel resets while the next number spins,
  // then its XP climbs as each badge is revealed and settles on the roll's rarity.
  const panel = useMemo((): { xp: number; status: RollPanelStatus } => {
    if (rolling || (current && !currentLanded)) return { xp: 0, status: 'rolling' };
    if (!current) return { xp: 0, status: 'idle' };
    if (revealedId === current.id) return { xp: current.xp, status: 'final' };
    const shown = progress?.id === current.id ? progress.shown : 0;
    return { xp: current.badges.slice(0, shown).reduce((sum, b) => sum + b.xp, 0), status: 'counting' };
  }, [rolling, current, currentLanded, revealedId, progress]);

  // The collection count and best roll also wait for the reveal, so the side panel never spoils it.
  const pendingBadges = useMemo(() => {
    if (!current || revealedId === current.id) return 0;
    const shown = progress?.id === current.id ? progress.shown : 0;
    return current.badges.slice(shown).filter((b) => b.isNew).length;
  }, [current, revealedId, progress]);
  const player = useMemo(
    () => (state.player ? { ...state.player, uniqueBadges: state.player.uniqueBadges - pendingBadges } : null),
    [state.player, pendingBadges],
  );
  const best = current && current.bestImproved && revealedId !== current.id ? state.bestBefore : state.best;

  // Beat your best roll and a toast says so, once the reveal has finished.
  const [toast, setToast] = useState<BestToast | null>(null);
  const toastedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!current || revealedId !== current.id || toastedFor.current === current.id) return;
    toastedFor.current = current.id;
    if (current.bestImproved && current.rollNumber > 1) {
      setToast({ key: current.id, roll: current.roll.text, xp: current.xp, rarity: current.rarity });
    }
  }, [current, revealedId]);
  const dismissToast = useCallback(() => setToast(null), []);

  // Legendary rolls and up light the stage in the roll's rarity colour.
  const glow = useMemo(() => {
    if (!current || revealedId !== current.id) return null;
    const index = rarityIndexForXp(current.xp);
    if (index < 5) return null;
    return { color: rarityForXp(current.xp).color, strength: Math.min(1, (index - 4) / 8) };
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

  const r = rarityForXp(panel.xp);
  return (
    <div
      className="app"
      data-motion={reducedMotion ? 'reduced' : 'full'}
      style={{ '--rarity': r.color, '--rarity-paint': rarityPaint(r) } as CSSProperties}
    >
      <header className="topbar">
        <h1 className="logo">
          <a href="/" className="logo-link" title="RNG Badges home">
            RNG BADGES
          </a>
        </h1>
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
          <RollRarityPanel xp={panel.xp} status={panel.status} />
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

      <BestRollToast toast={toast} onDismiss={dismissToast} />

      {view === 'collection' && (
        <CollectionSheet catalog={catalog} player={player} discoveries={state.discoveries} revealed={state.revealed} onClose={() => setView('play')} />
      )}
      {view === 'leaderboards' && <LeaderboardSheet token={state.token} totalBadges={catalog.badges.length} onClose={() => setView('play')} />}
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

function BestRollToast({ toast, onDismiss }: { toast: BestToast | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(onDismiss, 4200);
    return () => window.clearTimeout(t);
  }, [toast, onDismiss]);
  if (!toast) return null;
  const r = rarity(toast.rarity);
  return (
    <div key={toast.key} className="toast" role="status" style={{ '--rarity-paint': rarityPaint(r), '--rarity': r.color } as CSSProperties}>
      <p className="toast-kicker">New best roll</p>
      <p className="toast-title">{r.name}</p>
      <p className="toast-sub">
        {toast.roll} · {formatNumber(toast.xp)} XP
      </p>
      <button type="button" className="icon-button toast-close" onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
