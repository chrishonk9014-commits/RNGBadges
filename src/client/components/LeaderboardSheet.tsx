import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import type { BestLeaderboardEntry, LeaderboardResponse, XpLeaderboardEntry } from '../../shared/api';
import { api } from '../api';
import { formatNumber, rarity, rarityPaint, tier, timeAgo } from '../format';
import { RollText } from './RollNumber';
import { Sheet } from './Sheet';

type Tab = 'xp' | 'best';
const REFRESH_MS = 10_000;

export function LeaderboardSheet({ token, initialTab = 'xp', onClose }: { token: string | null; initialTab?: Tab; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [xp, setXp] = useState<LeaderboardResponse<XpLeaderboardEntry> | null>(null);
  const [best, setBest] = useState<LeaderboardResponse<BestLeaderboardEntry> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [x, b] = await Promise.all([
        api<LeaderboardResponse<XpLeaderboardEntry>>('/api/leaderboard/xp?limit=50', { token }),
        api<LeaderboardResponse<BestLeaderboardEntry>>('/api/leaderboard/best?limit=50', { token }),
      ]);
      setXp(x);
      setBest(b);
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

  const data = tab === 'xp' ? xp : best;
  return (
    <Sheet title="Leaderboards" onClose={onClose} wide>
      <div className="segmented tabs" role="tablist" aria-label="Leaderboard">
        <button type="button" role="tab" aria-selected={tab === 'xp'} data-autofocus={tab === 'xp' ? true : undefined} onClick={() => setTab('xp')}>
          Total XP
        </button>
        <button type="button" role="tab" aria-selected={tab === 'best'} data-autofocus={tab === 'best' ? true : undefined} onClick={() => setTab('best')}>
          Best Number Rolled
        </button>
      </div>
      <p className="muted leaderboard-note">
        {tab === 'xp'
          ? 'Ranked by total XP earned from badge discoveries.'
          : 'Ranked by roll score: the combined value of every badge a single roll triggered — not by how big the number is.'}{' '}
        {data && `${formatNumber(data.totalPlayers)} player${data.totalPlayers === 1 ? '' : 's'} on the board. Updates every 10 seconds.`}
      </p>
      {error && <p className="notice">Couldn’t load the leaderboard: {error}</p>}
      {!data && !error && <p className="muted">Loading…</p>}
      {data && data.entries.length === 0 && <p className="muted">Nobody has rolled yet. Be the first.</p>}
      {tab === 'xp' && xp && xp.entries.length > 0 && <XpTable data={xp} />}
      {tab === 'best' && best && best.entries.length > 0 && <BestTable data={best} />}
    </Sheet>
  );
}

function XpTable({ data }: { data: LeaderboardResponse<XpLeaderboardEntry> }) {
  const rows = [...data.entries];
  const youOutside = data.you && !rows.some((r) => r.playerId === data.you!.playerId);
  return (
    <table className="board">
      <thead>
        <tr>
          <th scope="col">#</th>
          <th scope="col">Player</th>
          <th scope="col">Rarity</th>
          <th scope="col" className="num">
            XP
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <XpRow key={r.playerId} row={r} you={r.playerId === data.you?.playerId} />
        ))}
        {youOutside && (
          <>
            <tr className="board-gap" aria-hidden>
              <td colSpan={4}>⋯</td>
            </tr>
            <XpRow row={data.you!} you />
          </>
        )}
      </tbody>
    </table>
  );
}

function XpRow({ row, you }: { row: XpLeaderboardEntry; you: boolean }) {
  const r = rarity(row.rarity);
  return (
    <tr className={you ? 'is-you' : undefined}>
      <td className="rank">{row.rank}</td>
      <td className="player">
        {row.username}
        {you && <span className="you-chip">you</span>}
      </td>
      <td>
        <span className="rarity-pill" style={{ '--rarity-paint': rarityPaint(r) } as CSSProperties}>
          {r.name}
        </span>
      </td>
      <td className="num">{formatNumber(row.xp)}</td>
    </tr>
  );
}

function BestTable({ data }: { data: LeaderboardResponse<BestLeaderboardEntry> }) {
  const rows = [...data.entries];
  const youOutside = data.you && !rows.some((r) => r.playerId === data.you!.playerId);
  return (
    <table className="board board-best">
      <thead>
        <tr>
          <th scope="col">#</th>
          <th scope="col">Number</th>
          <th scope="col">Player</th>
          <th scope="col">Standout badges</th>
          <th scope="col" className="num">
            Score
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
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
          {row.badges.map((b) => (
            <li key={b.id} className="chip" style={{ '--tier': tier(b.tier).color } as CSSProperties} title={`${tier(b.tier).name} · ${formatNumber(b.xp)} XP`}>
              {b.name}
            </li>
          ))}
        </ul>
      </td>
      <td className="num">{formatNumber(row.score)}</td>
    </tr>
  );
}
