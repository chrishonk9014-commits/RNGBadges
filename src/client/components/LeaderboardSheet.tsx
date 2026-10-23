import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import type { BestLeaderboardEntry, CollectionLeaderboardEntry, LeaderboardResponse } from '../../shared/api';
import { LOCAL_GAME, api } from '../api';
import type { TopRoll, TopRollsResponse } from '../local/localGame';
import { formatNumber, rarity, rarityPaint, tier, timeAgo } from '../format';
import { RollText } from './RollNumber';
import { Sheet } from './Sheet';

type Tab = 'best' | 'collection';
const REFRESH_MS = 10_000;

interface Props {
  token: string | null;
  totalBadges: number;
  initialTab?: Tab;
  onClose: () => void;
}

export function LeaderboardSheet(props: Props) {
  return LOCAL_GAME ? <TopRollsSheet onClose={props.onClose} /> : <GlobalLeaderboards {...props} />;
}

function GlobalLeaderboards({ token, totalBadges, initialTab = 'best', onClose }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [best, setBest] = useState<LeaderboardResponse<BestLeaderboardEntry> | null>(null);
  const [collection, setCollection] = useState<LeaderboardResponse<CollectionLeaderboardEntry> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [b, c] = await Promise.all([
        api<LeaderboardResponse<BestLeaderboardEntry>>('/api/leaderboard/best?limit=50', { token }),
        api<LeaderboardResponse<CollectionLeaderboardEntry>>('/api/leaderboard/collection?limit=50', { token }),
      ]);
      setBest(b);
      setCollection(c);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [token]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const data = tab === 'best' ? best : collection;
  return (
    <Sheet title="Leaderboards" onClose={onClose} wide>
      <div className="segmented tabs" role="tablist" aria-label="Leaderboard">
        <button type="button" role="tab" aria-selected={tab === 'best'} data-autofocus={tab === 'best' ? true : undefined} onClick={() => setTab('best')}>
          Best Roll
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'collection'}
          data-autofocus={tab === 'collection' ? true : undefined}
          onClick={() => setTab('collection')}
        >
          Most Badges
        </button>
      </div>
      <p className="muted leaderboard-note">
        {tab === 'best'
          ? "Each player's single best roll, ranked by its XP: every badge in the number added together. How big the number is doesn't count."
          : 'Ranked by how many different badges each player has found.'}{' '}
        {data && `${formatNumber(data.totalPlayers)} player${data.totalPlayers === 1 ? '' : 's'} on the board. Updates every 10 seconds.`}
      </p>
      {error && <p className="notice">Couldn’t load the leaderboard: {error}</p>}
      {!data && !error && <p className="muted">Loading…</p>}
      {data && data.entries.length === 0 && <p className="muted">Nobody has rolled yet. Be the first.</p>}
      {tab === 'best' && best && best.entries.length > 0 && <BestTable data={best} />}
      {tab === 'collection' && collection && collection.entries.length > 0 && <CollectionTable data={collection} totalBadges={totalBadges} />}
    </Sheet>
  );
}

function CollectionTable({ data, totalBadges }: { data: LeaderboardResponse<CollectionLeaderboardEntry>; totalBadges: number }) {
  const youOutside = data.you && !data.entries.some((r) => r.playerId === data.you!.playerId);
  const row = (r: CollectionLeaderboardEntry, you: boolean) => (
    <tr key={`${r.playerId}${you ? '-you' : ''}`} className={you ? 'is-you' : undefined}>
      <td className="rank">{r.rank}</td>
      <td className="player">
        {r.username}
        {you && <span className="you-chip">you</span>}
      </td>
      <td className="muted">{totalBadges ? `${((r.badges / totalBadges) * 100).toFixed(1)}% complete` : ''}</td>
      <td className="num">{formatNumber(r.badges)}</td>
    </tr>
  );
  return (
    <table className="board">
      <thead>
        <tr>
          <th scope="col">#</th>
          <th scope="col">Player</th>
          <th scope="col">Collection</th>
          <th scope="col" className="num">
            Badges
          </th>
        </tr>
      </thead>
      <tbody>
        {data.entries.map((r) => row(r, r.playerId === data.you?.playerId))}
        {youOutside && (
          <>
            <tr className="board-gap" aria-hidden>
              <td colSpan={4}>⋯</td>
            </tr>
            {row(data.you!, true)}
          </>
        )}
      </tbody>
    </table>
  );
}

function BestTable({ data }: { data: LeaderboardResponse<BestLeaderboardEntry> }) {
  const youOutside = data.you && !data.entries.some((r) => r.playerId === data.you!.playerId);
  return (
    <table className="board board-best">
      <thead>
        <tr>
          <th scope="col">#</th>
          <th scope="col">Number</th>
          <th scope="col">Player</th>
          <th scope="col">Rarity and standout badges</th>
          <th scope="col" className="num">
            XP
          </th>
        </tr>
      </thead>
      <tbody>
        {data.entries.map((r) => (
          <BestRow key={r.playerId} row={r} you={r.playerId === data.you?.playerId} />
        ))}
        {youOutside && (
          <>
            <tr className="board-gap" aria-hidden>
              <td colSpan={5}>⋯</td>
            </tr>
            <BestRow row={data.you!} you />
          </>
        )}
      </tbody>
    </table>
  );
}

function BestRow({ row, you }: { row: BestLeaderboardEntry; you: boolean }) {
  const r = rarity(row.rarity);
  return (
    <tr className={you ? 'is-you' : undefined}>
      <td className="rank">{row.rank}</td>
      <td className="board-number">
        <RollText text={row.roll} />
      </td>
      <td className="player">
        {row.username}
        {you && <span className="you-chip">you</span>}
        <span className="board-when">{timeAgo(row.at)}</span>
      </td>
      <td>
        <ul className="chips">
          <li className="rarity-pill" style={{ '--rarity-paint': rarityPaint(r) } as CSSProperties}>
            {r.name}
          </li>
          {row.badges.map((b) => (
            <li key={b.id} className="chip" style={{ '--tier': tier(b.tier).color } as CSSProperties} title={`${tier(b.tier).name} · ${formatNumber(b.xp)} XP`}>
              {b.name}
            </li>
          ))}
        </ul>
      </td>
      <td className="num">{formatNumber(row.xp)}</td>
    </tr>
  );
}

/** The browser version has no shared server, so it ranks the player's own rolls instead. */
function TopRollsSheet({ onClose }: { onClose: () => void }) {
  const [rolls, setRolls] = useState<TopRoll[] | null>(null);
  useEffect(() => {
    api<TopRollsResponse>('/api/local/top').then(
      (r) => setRolls(r.rolls),
      () => setRolls([]),
    );
  }, []);
  return (
    <Sheet title="Your Top Rolls" onClose={onClose} wide>
      <p className="muted leaderboard-note">
        This copy of RNG Badges runs in your browser and saves on this device, so there are no global leaderboards here. These are your ten best rolls, ranked by XP.
      </p>
      {!rolls && <p className="muted">Loading…</p>}
      {rolls && rolls.length === 0 && <p className="muted">Roll a few numbers and your best ones will show up here.</p>}
      {rolls && rolls.length > 0 && (
        <table className="board board-top">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Number</th>
              <th scope="col">Rarity and standout badges</th>
              <th scope="col" className="num">
                XP
              </th>
            </tr>
          </thead>
          <tbody>
            {rolls.map((row, i) => {
              const r = rarity(row.rarity);
              return (
                <tr key={`${row.rollNumber}-${row.at}`}>
                  <td className="rank">{i + 1}</td>
                  <td className="board-number">
                    <RollText text={row.roll} />
                    <span className="board-when">
                      Roll {formatNumber(row.rollNumber)} · {timeAgo(row.at)}
                    </span>
                  </td>
                  <td>
                    <ul className="chips">
                      <li className="rarity-pill" style={{ '--rarity-paint': rarityPaint(r) } as CSSProperties}>
                        {r.name}
                      </li>
                      {row.badges.map((b) => (
                        <li key={b.id} className="chip" style={{ '--tier': tier(b.tier).color } as CSSProperties} title={`${tier(b.tier).name} · ${formatNumber(b.xp)} XP`}>
                          {b.name}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="num">{formatNumber(row.xp)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Sheet>
  );
}
