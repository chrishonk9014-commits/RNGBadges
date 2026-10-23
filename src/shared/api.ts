/** Wire types shared by the server and the client. */
import type { CategoryId } from './badges/types';
import type { RollCell } from './roll';

export interface BadgeView {
  id: string;
  name: string;
  description: string;
  flavor?: string;
  category: CategoryId;
  family?: string;
  hidden: boolean;
  /** False when the badge is hidden and this player hasn't found it: name and text are redacted. */
  revealed: boolean;
  probability: number;
  xp: number;
  tier: string;
}

export interface CatalogResponse {
  version: string;
  totalXp: number;
  badges: BadgeView[];
}

export interface PlayerSummary {
  id: number;
  username: string;
  xp: number;
  rarity: string;
  rolls: number;
  uniqueBadges: number;
}

export interface RollView {
  text: string;
  digits: string;
  skips: number;
  seven: boolean;
  cells: RollCell[];
}

export interface AwardedBadge extends BadgeView {
  isNew: boolean;
}

export interface RollResponse {
  id: string;
  rollNumber: number;
  roll: RollView;
  /** Every badge this roll earned, worst first and best last. */
  badges: AwardedBadge[];
  xpGained: number;
  score: number;
  bestImproved: boolean;
  rankUp: { from: string; to: string } | null;
  player: PlayerSummary;
}

export interface Discovery {
  badgeId: string;
  at: number;
  roll: string;
  rollNumber: number;
}

export interface ProfileResponse {
  player: PlayerSummary;
  discoveries: Discovery[];
  /** Full details for hidden badges this player has found. */
  revealed: BadgeView[];
  best: BestRoll | null;
}

export interface BestRoll {
  roll: string;
  score: number;
  at: number;
  badges: Array<Pick<BadgeView, 'id' | 'name' | 'tier' | 'xp'>>;
}

export interface RegisterResponse {
  token: string;
  player: PlayerSummary;
}

export interface XpLeaderboardEntry {
  rank: number;
  playerId: number;
  username: string;
  xp: number;
  rarity: string;
}

export interface BestLeaderboardEntry extends BestRoll {
  rank: number;
  playerId: number;
  username: string;
}

export interface LeaderboardResponse<T> {
  entries: T[];
  totalPlayers: number;
  you: T | null;
}

export interface BadgeStatsResponse {
  players: number;
  counts: Record<string, number>;
}

export interface ApiError {
  error: string;
  message: string;
  retryAfterMs?: number;
}
