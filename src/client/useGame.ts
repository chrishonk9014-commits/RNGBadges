import { useCallback, useEffect, useReducer, useRef } from 'react';
import type {
  BadgeView,
  BestRoll,
  CatalogResponse,
  Discovery,
  PlayerSummary,
  ProfileResponse,
  RegisterResponse,
  RollResponse,
} from '../shared/api';
import { ApiError, api, isNetworkError } from './api';
import { loadToken, saveToken } from './storage';

const HISTORY_LIMIT = 30;

export interface GameState {
  phase: 'loading' | 'ready' | 'error';
  error: string | null;
  notice: string | null;
  token: string | null;
  catalog: CatalogResponse | null;
  player: PlayerSummary | null;
  discoveries: Record<string, Discovery>;
  /** Hidden badges this player has found, with their real names. */
  revealed: Record<string, BadgeView>;
  best: BestRoll | null;
  /** Best roll before the latest one, shown until the latest roll's reveal finishes. */
  bestBefore: BestRoll | null;
  /** The latest roll — what the Badges Collected column shows. */
  current: RollResponse | null;
  /** Earlier rolls this session, newest first. Nothing is lost when you roll again. */
  history: RollResponse[];
  rolling: boolean;
}

type Action =
  | { type: 'loaded'; token: string; catalog: CatalogResponse; profile: ProfileResponse }
  | { type: 'failed'; message: string }
  | { type: 'rollStart' }
  | { type: 'rollDone'; res: RollResponse; at: number }
  | { type: 'rollFailed'; message: string }
  | { type: 'player'; player: PlayerSummary }
  | { type: 'notice'; message: string | null };

const initial: GameState = {
  phase: 'loading',
  error: null,
  notice: null,
  token: null,
  catalog: null,
  player: null,
  discoveries: {},
  revealed: {},
  best: null,
  bestBefore: null,
  current: null,
  history: [],
  rolling: false,
};

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'loaded':
      return {
        ...initial,
        phase: 'ready',
        token: action.token,
        catalog: action.catalog,
        player: action.profile.player,
        discoveries: Object.fromEntries(action.profile.discoveries.map((d) => [d.badgeId, d])),
        revealed: Object.fromEntries(action.profile.revealed.map((b) => [b.id, b])),
        best: action.profile.best,
        bestBefore: action.profile.best,
      };
    case 'failed':
      return { ...state, phase: 'error', error: action.message };
    case 'rollStart':
      return { ...state, rolling: true, notice: null };
    case 'rollDone': {
      const { res, at } = action;
      const discoveries = { ...state.discoveries };
      const revealed = { ...state.revealed };
      for (const b of res.badges) {
        if (!b.isNew) continue;
        discoveries[b.id] = { badgeId: b.id, at, roll: res.roll.text, rollNumber: res.rollNumber };
        if (b.hidden) revealed[b.id] = b;
      }
      const best: BestRoll | null = res.bestImproved
        ? {
            roll: res.roll.text,
            xp: res.xp,
            rarity: res.rarity,
            at,
            badges: [...res.badges].reverse().slice(0, 3).map(({ id, name, tier, xp }) => ({ id, name, tier, xp })),
          }
        : state.best;
      return {
        ...state,
        rolling: false,
        player: res.player,
        discoveries,
        revealed,
        best,
        bestBefore: state.best,
        current: res,
        history: state.current ? [state.current, ...state.history].slice(0, HISTORY_LIMIT) : state.history,
      };
    }
    case 'rollFailed':
      return { ...state, rolling: false, notice: action.message };
    case 'player':
      return { ...state, player: action.player };
    case 'notice':
      return { ...state, notice: action.message };
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function loadEverything(preferredToken: string | null): Promise<Extract<Action, { type: 'loaded' }>> {
  const catalog = await api<CatalogResponse>('/api/catalog');
  let token = preferredToken;
  let profile: ProfileResponse | null = null;
  if (token) {
    try {
      profile = await api<ProfileResponse>('/api/me', { token });
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) throw e;
      token = null;
    }
  }
  if (!token || !profile) {
    const created = await api<RegisterResponse>('/api/players', { method: 'POST', body: {} });
    token = created.token;
    profile = await api<ProfileResponse>('/api/me', { token });
  }
  saveToken(token);
  return { type: 'loaded', token, catalog, profile };
}

export function useGame() {
  const [state, dispatch] = useReducer(reducer, initial);
  const inFlight = useRef(false);
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = state.token;

  const boot = useCallback(async (token: string | null) => {
    try {
      dispatch(await loadEverything(token));
    } catch (e) {
      dispatch({
        type: 'failed',
        message: isNetworkError(e) ? 'Can’t reach the RNG Badges server. Is it running?' : (e as Error).message,
      });
    }
  }, []);

  // Once per page load; StrictMode's double effect run must not register two guests.
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    void boot(loadToken());
  }, [boot]);

  const roll = useCallback(async () => {
    const token = tokenRef.current;
    if (inFlight.current || !token) return;
    inFlight.current = true;
    dispatch({ type: 'rollStart' });
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          const res = await api<RollResponse>('/api/roll', {
            method: 'POST',
            token,
            body: { tzOffset: new Date().getTimezoneOffset() },
          });
          dispatch({ type: 'rollDone', res, at: Date.now() });
          return;
        } catch (e) {
          if (e instanceof ApiError && e.status === 429 && attempt < 2) {
            await sleep(Math.min(2000, e.retryAfterMs ?? 300));
            continue;
          }
          throw e;
        }
      }
    } catch (e) {
      dispatch({
        type: 'rollFailed',
        message: isNetworkError(e) ? 'Lost connection to the server — your progress is safe. Try again.' : (e as Error).message,
      });
    } finally {
      inFlight.current = false;
    }
  }, []);

  const rename = useCallback(async (username: string) => {
    const player = await api<PlayerSummary>('/api/me', { method: 'PATCH', token: tokenRef.current, body: { username } });
    dispatch({ type: 'player', player });
  }, []);

  /** Switches this browser to another account using its save code. */
  const restore = useCallback(async (code: string) => {
    const token = code.trim();
    await api<ProfileResponse>('/api/me', { token });
    saveToken(token);
    await boot(token);
  }, [boot]);

  const retry = useCallback(() => void boot(tokenRef.current ?? loadToken()), [boot]);
  const clearNotice = useCallback(() => dispatch({ type: 'notice', message: null }), []);

  return { state, roll, rename, restore, retry, clearNotice };
}
