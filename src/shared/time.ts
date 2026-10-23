import type { LocalTime } from './badges/types';

/** Wall-clock time in the player's zone. `tzOffsetMinutes` follows Date#getTimezoneOffset (UTC − local). */
export function localTime(nowMs: number, tzOffsetMinutes: number): LocalTime {
  const d = new Date(nowMs - tzOffsetMinutes * 60_000);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
  };
}

/** Keeps a client-supplied offset within real time zones (UTC−14 to UTC+14). */
export function clampTzOffset(tzOffsetMinutes: number): number {
  return Number.isFinite(tzOffsetMinutes) ? Math.max(-840, Math.min(840, Math.round(tzOffsetMinutes))) : 0;
}
