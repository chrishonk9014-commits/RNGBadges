import type { CSSProperties } from 'react';
import type { BestRoll, PlayerSummary, RollResponse } from '../../shared/api';
import { rarityProgress } from '../../shared/progression';
import { formatNumber, rarityPaint, tier } from '../format';
import { RollText } from './RollNumber';

/** Current rarity, total XP and progress to the next rarity. */
export function RarityPanel({ player }: { player: PlayerSummary }) {
  const p = rarityProgress(player.xp);
  const paint = rarityPaint(p.current);
  return (
    <section className="rarity" aria-label="Rarity progress" style={{ '--rarity': p.current.color, '--rarity-paint': paint } as CSSProperties}>
      <div className="rarity-top">
        <div>
          <p className="rarity-label">Rarity</p>
          <p className={`rarity-name rarity-${p.current.id}`}>{p.current.name}</p>
        </div>
        <div className="rarity-xp">
          <p className="rarity-label">Total XP</p>
          <p className="rarity-xp-value">{formatNumber(player.xp)}</p>
        </div>
      </div>
      <div
        className="rarity-bar"
        role="progressbar"
        aria-label={p.next ? `Progress to ${p.next.name}` : 'Top rarity reached'}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(p.fraction * 100)}
      >
        <span style={{ width: `${Math.max(1.5, p.fraction * 100)}%` }} />
      </div>
      <p className="rarity-next">
        {p.next ? (
          <>
            {formatNumber(p.next.minXp - player.xp)} XP to <strong style={{ color: p.next.color }}>{p.next.name}</strong>
          </>
        ) : (
          <>The top of the ladder. INFINITE.</>
        )}
      </p>
    </section>
  );
}

export function StatsPanel({ player, totalBadges, best, onOpenCollection }: { player: PlayerSummary; totalBadges: number; best: BestRoll | null; onOpenCollection: () => void }) {
  const pct = totalBadges ? (player.uniqueBadges / totalBadges) * 100 : 0;
  return (
    <section className="panel stats" aria-label="Your stats">
      <button type="button" className="stats-collection" onClick={onOpenCollection}>
        <span className="stats-label">Collection</span>
        <span className="stats-value">
          {formatNumber(player.uniqueBadges)} <small>/ {formatNumber(totalBadges)}</small>
        </span>
        <span className="mini-bar" aria-hidden>
          <span style={{ width: `${Math.max(1, pct)}%` }} />
        </span>
        <span className="stats-sub">{pct.toFixed(1)}% discovered · open collection →</span>
      </button>
      <div className="stats-row">
        <div>
          <span className="stats-label">Rolls</span>
          <span className="stats-value">{formatNumber(player.rolls)}</span>
        </div>
        <div>
          <span className="stats-label">Best roll</span>
          <span className="stats-value stats-best">{best ? <RollText text={best.roll} /> : '—'}</span>
        </div>
      </div>
    </section>
  );
}

/** Every earlier roll this session, so badges from an interrupted reveal are never lost. */
export function RecentRolls({ history }: { history: RollResponse[] }) {
  return (
    <section className="panel recent" aria-labelledby="recent-title">
      <h2 id="recent-title">Recent Rolls</h2>
      {history.length === 0 ? (
        <p className="muted">Your previous rolls will stack up here.</p>
      ) : (
        <ol className="recent-list">
          {history.map((r) => {
            const top = r.badges.at(-1);
            return (
              <li key={r.id}>
                <details>
                  <summary>
                    <RollText text={r.roll.text} className="recent-number" />
                    <span className="recent-best" style={top ? ({ '--tier': tier(top.tier).color } as CSSProperties) : undefined}>
                      {top ? top.name : 'No badges'}
                      {r.badges.length > 1 && <span className="muted"> +{r.badges.length - 1}</span>}
                    </span>
                    <span className={`recent-xp${r.xpGained > 0 ? ' has-xp' : ''}`}>{r.xpGained > 0 ? `+${formatNumber(r.xpGained)}` : '0'} XP</span>
                  </summary>
                  {r.badges.length > 0 && (
                    <ul className="recent-badges">
                      {[...r.badges].reverse().map((b) => (
                        <li key={b.id} style={{ '--tier': tier(b.tier).color } as CSSProperties}>
                          <span>{b.name}</span>
                          <span className="muted">
                            {b.isNew ? `+${formatNumber(b.xp)}` : formatNumber(b.xp)} XP{b.isNew ? ' · new' : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </details>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
