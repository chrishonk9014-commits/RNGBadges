/**
 * Answers the game's API requests in the browser, for builds with no game
 * server (see LocalGame). Only the routes the browser version supports exist.
 */
import { ApiError } from '../api';
import { LocalGame, LocalGameError, type KeyValueStore } from './localGame';

function browserStorage(): KeyValueStore | null {
  try {
    const storage = window.localStorage;
    storage.getItem(':probe');
    return storage;
  } catch {
    return null;
  }
}

let game: LocalGame | null = null;

export function localApi<T>(path: string, init: { method?: string; body?: unknown }): T {
  game ??= new LocalGame({ storage: browserStorage() });
  const body = (init.body ?? {}) as Record<string, unknown>;
  const route = `${init.method ?? 'GET'} ${path.split('?')[0]}`;
  try {
    switch (route) {
      case 'GET /api/catalog':
        return game.catalog() as T;
      case 'POST /api/players':
        return game.register() as T;
      case 'GET /api/me':
        return game.profile() as T;
      case 'PATCH /api/me':
        return game.rename(String(body.username ?? '')) as T;
      case 'POST /api/roll':
        return game.roll(Number(body.tzOffset ?? 0)) as T;
      case 'GET /api/local/top':
        return game.topRolls() as T;
      case 'GET /api/local/status':
        return { persistent: game.persistent } as T;
      case 'GET /api/local/save':
        return { save: game.exportSave() } as T;
      case 'POST /api/local/save':
        return game.importSave(String(body.save ?? '')) as T;
      default:
        throw new ApiError(404, 'not_found', 'Not available in the browser version of the game.');
    }
  } catch (e) {
    if (e instanceof LocalGameError) throw new ApiError(e.status, e.code, e.message);
    throw e;
  }
}
