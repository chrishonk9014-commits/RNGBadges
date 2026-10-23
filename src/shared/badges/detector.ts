import type { Roll } from '../roll';
import { computeFacts } from './facts';
import type { BadgeDef, RollContext, RollFacts } from './types';

interface MaskGroup {
  length: number;
  positions: number[];
  table: Map<string, string[]>;
}

function push<K>(map: Map<K, string[]>, key: K, id: string): void {
  const list = map.get(key);
  if (list) list.push(id);
  else map.set(key, [id]);
}

/**
 * Evaluates every badge against a roll without looping over the whole catalog.
 *
 * Substring, prefix, suffix, exact, mask, value and skip rules are indexed by
 * the key they look for, so a roll only does a handful of map lookups for
 * them no matter how many such badges exist. Only free-form `test` and
 * `context` rules run one by one.
 */
export class BadgeDetector {
  private readonly contains = new Map<string, string[]>();
  private readonly starts = new Map<string, string[]>();
  private readonly ends = new Map<string, string[]>();
  private readonly exact = new Map<string, string[]>();
  private readonly values = new Map<number, string[]>();
  private readonly skips = new Map<number, string[]>();
  private readonly maskGroups = new Map<string, MaskGroup>();
  private readonly tests: Array<{ id: string; test: (f: RollFacts) => boolean }> = [];
  private readonly contextTests: Array<{ id: string; test: (f: RollFacts, c: RollContext) => boolean }> = [];
  private containsLengths: number[] = [];
  private startLengths: number[] = [];
  private endLengths: number[] = [];

  constructor(defs: readonly BadgeDef[]) {
    for (const def of defs) this.index(def);
    this.containsLengths = [...new Set([...this.contains.keys()].map((k) => k.length))].sort((a, b) => a - b);
    this.startLengths = [...new Set([...this.starts.keys()].map((k) => k.length))];
    this.endLengths = [...new Set([...this.ends.keys()].map((k) => k.length))];
  }

  private index(def: BadgeDef): void {
    const { rule, id } = def;
    switch (rule.kind) {
      case 'contains':
        push(this.contains, rule.value, id);
        break;
      case 'startsWith':
        push(this.starts, rule.value, id);
        break;
      case 'endsWith':
        push(this.ends, rule.value, id);
        break;
      case 'exact':
        push(this.exact, rule.value, id);
        break;
      case 'values':
        for (const v of new Set(rule.values)) push(this.values, v, id);
        break;
      case 'skips':
        push(this.skips, rule.count, id);
        break;
      case 'mask': {
        const positions: number[] = [];
        let key = '';
        for (let i = 0; i < rule.mask.length; i++) {
          const ch = rule.mask[i]!;
          if (ch !== '_') {
            positions.push(i);
            key += ch;
          }
        }
        const signature = `${rule.mask.length}:${positions.join(',')}`;
        let group = this.maskGroups.get(signature);
        if (!group) {
          group = { length: rule.mask.length, positions, table: new Map() };
          this.maskGroups.set(signature, group);
        }
        push(group.table, key, id);
        break;
      }
      case 'test':
        this.tests.push({ id, test: rule.test });
        break;
      case 'context':
        this.contextTests.push({ id, test: rule.test });
        break;
    }
  }

  /** Ids of every badge the roll earns (each at most once). Context badges need `ctx`. */
  detect(roll: Roll, ctx?: RollContext): string[] {
    return this.detectFacts(computeFacts(roll), ctx);
  }

  detectFacts(facts: RollFacts, ctx?: RollContext): string[] {
    const found = new Set<string>();
    const add = (ids: string[] | undefined): void => {
      if (ids) for (const id of ids) found.add(id);
    };
    const { digits, length, roll } = facts;

    for (const len of this.containsLengths) {
      if (len > length) break;
      for (let i = 0; i + len <= length; i++) add(this.contains.get(digits.slice(i, i + len)));
    }
    for (const len of this.startLengths) if (len <= length) add(this.starts.get(digits.slice(0, len)));
    for (const len of this.endLengths) if (len <= length) add(this.ends.get(digits.slice(length - len)));
    add(this.exact.get(digits));
    if (facts.value >= 0) add(this.values.get(facts.value));
    if (roll.seven) add(this.skips.get(roll.skips));
    for (const group of this.maskGroups.values()) {
      if (group.length !== length) continue;
      let key = '';
      for (const p of group.positions) key += digits[p];
      add(group.table.get(key));
    }
    for (const { id, test } of this.tests) if (test(facts)) found.add(id);
    if (ctx) for (const { id, test } of this.contextTests) if (test(facts, ctx)) found.add(id);
    return [...found];
  }
}
