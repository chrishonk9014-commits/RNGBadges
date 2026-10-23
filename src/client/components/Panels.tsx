import type { CSSProperties } from 'react';
import type { BestRoll, PlayerSummary, RollResponse } from '../../shared/api';
import rarityOdds from '../../shared/badges/rarityOdds.json';
import { RARITIES, rarityIndexForXp, rarityProgress } from '../../shared/progression';
import { formatNumber, rarity, rarityPaint, tier } from '../format';
import { RollText } from './RollNumber';

const ODDS = rarityOdds as Record<string, { band: number; atLeast: number }>;

/** "1 in 78" for a roll this rarity or better. */
export function rarityOddsText(id: string): string {
  const p = ODDS[id]?.atLeast ?? 1;
  return p >= 0.999 ? 'every roll' : `1 in ${formatNumber(1 / p)} rolls`;
}

export type RollPanelStatus = 'idle' | 'rolling' | 'counting' | 'final';

/**
 * The rarity of the roll on screen. Its XP is the sum of the badges revealed
 * so far, so it climbs the ladder during the reveal; the next roll starts at 0.
 */
export function RollRarityPanel({ xp, status }: { xp: number; status: RollPanelStatus }) {
  const p = rarityProgress(xp);
  const index = rarityIndexForXp(xp);
  const idle = status === 'idle';
  return (
    <section
      className={`rarity rarity-${status}`}
      aria-label="This roll's rarity"
      style={{ '--rarity': p.current.color, '--rarity-paint': rarityPaint(p.current) } as CSSProperties}
    >
      <div className="rarity-top">
        <div>
          <p className="rarity-label">{status === 'rolling' ? 'Rolling…' : 'This roll'}</p>
          <p className={`rarity-name rarity-${p.current.id}`}>{idle ? '—' : p.current.name}</p>
        </div>
        <div className="rarity-xp">
          <p className="rarity-label">Roll XP</p>
          <p className="rarity-xp-value">{idle ? '0' : formatNumber(xp)}</p>
        </div>
      </div>
      <ol className="rarity-steps" aria-hidden>
        {RARITIES.map((r, i) => (
          <li key={r.id} className={!idle && i <= index ? 'is-lit' : undefined} style={{ '--step': rarityPaint(r) } as CSSProperties} />
        ))}
      </ol>
      <p className="rarity-next">
        {idle && 'Every badge in a roll adds its XP. The total decides how rare the roll is.'}
        {status === 'rolling' && 'Rolling…'}
        {status === 'counting' &&
          (p.next ? (
            <>
              {formatNumber(p.next.minXp - xp)} XP to <strong style={{ color: p.next.color }}>{p.next.name}</strong>
            </>
          ) : (
            'INFINITE.'
          ))}
        {status === 'final' &&
          (index === 0 && p.next ? (
            <>
              {formatNumber(p.next.minXp - xp)} XP short of <strong style={{ color: p.next.color }}>{p.next.name}</strong>
            </>
          ) : (
            <>
              <strong style={{ color: p.current.color }}>{p.current.name}</strong> or better: {rarityOddsText(p.current.id)}
            </>
          ))}
      </p>
    </section>
  );
}

export function StatsPanel({ player, totalBadges, best, onOpenCollection }: { player: PlayerSummary; totalBadges: number; best: BestRoll | null; onOpenCollection: () => void }) {
  const pct = totalBadges ? (player.uniqueBadges / totalBadges) * 100 : 0;
  const bestRarity = best ? rarity(best.rarity) : null;
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
          {best && bestRarity ? (
            <span className="stats-best">
              <RollText text={best.roll} />
              <span className="stats-best-rarity" style={{ color: bestRarity.color }}>
                {bestRarity.name} · {formatNumber(best.xp)} XP
              </span>
            </span>
          ) : (
            <span className="stats-value">—</span>
          )}
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
            const rr = rarity(r.rarity);
            return (
              <li key={r.id}>
                <details>
                  <summary>
                    <RollText text={r.roll.text} className="recent-number" />
                    <span className="recent-best" style={top ? ({ '--tier': tier(top.tier).color } as CSSProperties) : undefined}>
                      {top ? top.name : 'No badges'}
                      {r.badges.length > 1 && <span className="muted"> +{r.badges.length - 1}</span>}
                    </span>
                    <span className="recent-xp" style={{ color: rr.color }}>
                      {rr.name} · {formatNumber(r.xp)}
                    </span>
                  </summary>
                  {r.badges.length > 0 && (
                    <ul className="recent-badges">
                      {[...r.badges].reverse().map((b) => (
                        <li key={b.id} style={{ '--tier': tier(b.tier).color } as CSSProperties}>
                          <span>{b.name}</span>
                          <span className="muted">
                            +{formatNumber(b.xp)} XP{b.isNew ? ' · new' : ''}
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
