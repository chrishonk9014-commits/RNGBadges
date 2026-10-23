import type { CSSProperties } from 'react';
import type { BadgeView } from '../../shared/api';
import { formatNumber, formatOdds, tier } from '../format';

interface Props {
  badge: BadgeView;
  isNew?: boolean;
  variant: 'spotlight' | 'row';
  best?: boolean;
}

/** One badge in the Badges Collected column: big in the spotlight, compact in the list. */
export function BadgeCard({ badge, isNew = false, variant, best = false }: Props) {
  const t = tier(badge.tier);
  const style = { '--tier': t.color } as CSSProperties;
  if (variant === 'row') {
    return (
      <li className={`badge-row${isNew ? ' is-new' : ''}`} style={style}>
        <span className="badge-row-dot" aria-hidden />
        <span className="badge-row-name">{badge.name}</span>
        <span className="badge-row-tier">{t.name}</span>
        <span className="badge-row-xp">{isNew ? `+${formatNumber(badge.xp)}` : formatNumber(badge.xp)} XP</span>
      </li>
    );
  }
  return (
    <article className={`badge-spot tier-${t.id}${isNew ? ' is-new' : ''}${best ? ' is-best' : ''}`} style={style}>
      <header className="badge-spot-head">
        <span className="tier-chip">{t.name}</span>
        {isNew ? <span className="new-chip">NEW</span> : <span className="owned-chip">Owned</span>}
        <span className="badge-spot-odds">{formatOdds(badge.probability)}</span>
      </header>
      <h3 className="badge-spot-name">{badge.name}</h3>
      <p className="badge-spot-desc">{badge.description}</p>
      {badge.flavor && <p className="badge-spot-flavor">{badge.flavor}</p>}
      <p className="badge-spot-xp">
        {isNew ? (
          <>
            <strong>+{formatNumber(badge.xp)}</strong> XP
          </>
        ) : (
          <>{formatNumber(badge.xp)} XP · already discovered</>
        )}
      </p>
    </article>
  );
}
