/**
 * Browser storage for per-device conveniences. Every access is guarded:
 * storage can be missing or throw (private windows, blocked site data).
 * Progress itself lives on the server; this only remembers which account
 * this browser uses.
 */
const TOKEN_KEY = 'rngbadges.token';
const MOTION_KEY = 'rngbadges.motion';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Not persisted; the session still works until the tab closes.
  }
}

export const loadToken = (): string | null => read(TOKEN_KEY);
export const saveToken = (token: string | null): void => write(TOKEN_KEY, token);

export type MotionPreference = 'system' | 'reduced' | 'full';
export const loadMotion = (): MotionPreference => {
  const v = read(MOTION_KEY);
  return v === 'reduced' || v === 'full' ? v : 'system';
};
export const saveMotion = (v: MotionPreference): void => write(MOTION_KEY, v === 'system' ? null : v);
