import type { Roll } from '../roll';

export type CategoryId =
  | 'funny'
  | 'reference'
  | 'history'
  | 'science'
  | 'calculator'
  | 'phoneword'
  | 'math'
  | 'poker'
  | 'pattern'
  | 'calendar'
  | 'special'
  | 'meta';

/** Everything a predicate may look at, computed once per roll. */
export interface RollFacts {
  roll: Roll;
  digits: string;
  length: number;
  /** Numeric value of the digits; -1 when every digit was skipped. */
  value: number;
  /** counts[d] = how many times digit d appears. */
  counts: number[];
  /** Digit multiplicities sorted high→low, e.g. "3-2-1" for 112333. */
  shape: string;
  sum: number;
  distinct: number;
}

export interface LocalTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** Per-player context for badges that compare a roll with something other than itself. */
export interface RollContext {
  previous: Roll | null;
  /** 1-based count of this roll in the player's lifetime. */
  rollNumber: number;
  local: LocalTime;
}

export type BadgeRule =
  /** The digit string contains `value` anywhere. */
  | { kind: 'contains'; value: string }
  | { kind: 'startsWith'; value: string }
  | { kind: 'endsWith'; value: string }
  /** The whole digit string equals `value`. */
  | { kind: 'exact'; value: string }
  /** Same length as the roll; digits are fixed, "_" is any digit. */
  | { kind: 'mask'; mask: string }
  /** The roll's numeric value is in the set. */
  | { kind: 'values'; values: readonly number[] }
  /** The 1000000 outcome with exactly this many skips. */
  | { kind: 'skips'; count: number }
  /** Arbitrary property of the roll itself. */
  | { kind: 'test'; test: (facts: RollFacts) => boolean }
  /**
   * Property of the roll relative to the player's context. Odds cannot be
   * enumerated from the roll alone, so the definition states them.
   */
  | { kind: 'context'; test: (facts: RollFacts, ctx: RollContext) => boolean; probability: number };

export interface BadgeDef {
  /** Stable forever: stored in players' collections. */
  id: string;
  name: string;
  /** The discovery condition, in plain words. */
  description: string;
  /** Optional flavour line shown under the description. */
  flavor?: string;
  category: CategoryId;
  rule: BadgeRule;
  /** Overrides the XP derived from the badge's odds. */
  xp?: number;
  /** Name and condition stay hidden until discovered. */
  hidden?: boolean;
  /** Groups deliberately related badges (e.g. the tiers of one reference). */
  family?: string;
}
