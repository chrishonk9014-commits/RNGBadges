import { useDeferredValue, useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { BadgeStatsResponse, BadgeView, CatalogResponse, Discovery, PlayerSummary } from '../../shared/api';
import type { CategoryId } from '../../shared/badges/types';
import { api } from '../api';
import { BADGE_TIERS, CATEGORY_NAMES, formatNumber, formatOdds, tier, timeAgo } from '../format';
import { IconLock, IconSearch } from './Icons';
import { RollText } from './RollNumber';
import { Sheet } from './Sheet';

type Status = 'all' | 'found' | 'locked';
type Sort = 'rarest' | 'common' | 'name' | 'recent';
const PAGE = 120;

interface Props {
  catalog: CatalogResponse;
  player: PlayerSummary;
  discoveries: Record<string, Discovery>;
  revealed: Record<string, BadgeView>;
  onClose: () => void;
}

export function CollectionSheet({ catalog, player, discoveries, revealed, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status>('all');
  const [category, setCategory] = useState<CategoryId | 'all'>('all');
  const [tierId, setTierId] = useState('all');
  const [sort, setSort] = useState<Sort>('rarest');
  const [limit, setLimit] = useState(PAGE);
  const [stats, setStats] = useState<BadgeStatsResponse | null>(null);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    api<BadgeStatsResponse>('/api/stats/badges').then(setStats, () => setStats(null));
  }, []);
  useEffect(() => setLimit(PAGE), [deferredQuery, status, category, tierId, sort]);

  const badges = useMemo(() => catalog.badges.map((b) => revealed[b.id] ?? b), [catalog, revealed]);
  const found = useMemo(() => badges.filter((b) => b.id in discoveries).length, [badges, discoveries]);
  const total = badges.length;
  const categories = useMemo(() => [...new Set(badges.map((b) => b.category))], [badges]);

  const visible = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const list = badges.filter((b) => {
      const owned = b.id in discoveries;
      if (status === 'found' && !owned) return false;
      if (status === 'locked' && owned) return false;
      if (category !== 'all' && b.category !== category) return false;
      if (tierId !== 'all' && b.tier !== tierId) return false;
      if (!q) return true;
      return [b.name, b.description, b.flavor ?? '', CATEGORY_NAMES[b.category], tier(b.tier).name].some((s) => s.toLowerCase().includes(q));
    });
    const byName = (a: BadgeView, b: BadgeView) => a.name.localeCompare(b.name);
    list.sort((a, b) => {
      switch (sort) {
        case 'rarest':
          return a.probability - b.probability || byName(a, b);
        case 'common':
          return b.probability - a.probability || byName(a, b);
        case 'name':
          return byName(a, b);
        case 'recent':
          return (discoveries[b.id]?.at ?? 0) - (discoveries[a.id]?.at ?? 0) || a.probability - b.probability;
      }
    });
    return list;
  }, [badges, discoveries, deferredQuery, status, category, tierId, sort]);

  const pct = total ? (found / total) * 100 : 0;
  return (
    <Sheet title="Badge Collection" onClose={onClose} wide>
      <div className="collection-summary">
        <div>
          <p className="stats-label">Discovered</p>
          <p className="collection-count">
            {formatNumber(found)} <small>/ {formatNumber(total)}</small>
          </p>
        </div>
        <div>
          <p className="stats-label">Complete</p>
          <p className="collection-count">{pct.toFixed(1)}%</p>
        </div>
        <div>
          <p className="stats-label">XP from badges</p>
          <p className="collection-count">
            {formatNumber(player.xp)} <small>/ {formatNumber(catalog.totalXp)}</small>
          </p>
        </div>
        <div className="mini-bar collection-bar" aria-hidden>
          <span style={{ width: `${Math.max(0.5, pct)}%` }} />
        </div>
      </div>

      <div className="collection-controls">
        <label className="search">
          <IconSearch />
          <span className="sr-only">Search badges</span>
          <input
            data-autofocus
            type="search"
            placeholder="Search names, numbers, descriptions…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="segmented" role="group" aria-label="Show">
          {(['all', 'found', 'locked'] as const).map((s) => (
            <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)}>
              {s === 'all' ? 'All' : s === 'found' ? 'Discovered' : 'Locked'}
            </button>
          ))}
        </div>
        <label className="select">
          <span className="sr-only">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value as CategoryId | 'all')}>
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_NAMES[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="select">
          <span className="sr-only">Rarity tier</span>
          <select value={tierId} onChange={(e) => setTierId(e.target.value)}>
            <option value="all">All tiers</option>
            {BADGE_TIERS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="select">
          <span className="sr-only">Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="rarest">Rarest first</option>
            <option value="common">Most common first</option>
            <option value="name">Name</option>
            <option value="recent">Recently discovered</option>
          </select>
        </label>
      </div>

      <p className="muted collection-results" aria-live="polite">
        {formatNumber(visible.length)} badge{visible.length === 1 ? '' : 's'}
      </p>
      <ul className="collection-grid">
        {visible.slice(0, limit).map((b) => (
          <CollectionCard key={b.id} badge={b} discovery={discoveries[b.id]} stats={stats} />
        ))}
      </ul>
      {visible.length > limit && (
        <button type="button" className="button-secondary show-more" onClick={() => setLimit((l) => l + PAGE)}>
          Show more ({formatNumber(visible.length - limit)} left)
        </button>
      )}
    </Sheet>
  );
}

function CollectionCard({ badge, discovery, stats }: { badge: BadgeView; discovery?: Discovery; stats: BadgeStatsResponse | null }) {
  const t = tier(badge.tier);
  const owned = discovery !== undefined;
  const foundBy = stats?.counts[badge.id] ?? 0;
  return (
    <li className={`collection-card${owned ? ' is-owned' : ' is-locked'}`} style={{ '--tier': t.color } as CSSProperties}>
      <div className="collection-card-head">
        <span className="tier-chip">{t.name}</span>
        {!owned && (
          <span className="lock" aria-label="Locked">
            <IconLock />
          </span>
        )}
        <span className="collection-card-xp">{formatNumber(badge.xp)} XP</span>
      </div>
      <h3>{badge.name}</h3>
      <p className="collection-card-desc">{badge.description}</p>
      {badge.flavor && owned && <p className="collection-card-flavor">{badge.flavor}</p>}
      <p className="collection-card-meta">
        <span>{formatOdds(badge.probability)}</span>
        <span>{CATEGORY_NAMES[badge.category]}</span>
        {stats && stats.players > 0 && (
          <span>
            {foundBy === 0 ? 'Undiscovered by anyone' : `Found by ${formatNumber(foundBy)} player${foundBy === 1 ? '' : 's'}`}
          </span>
        )}
      </p>
      {discovery && (
        <p className="collection-card-found">
          Found {timeAgo(discovery.at)} on roll #{formatNumber(discovery.rollNumber)}: <RollText text={discovery.roll} />
        </p>
      )}
    </li>
  );
}
