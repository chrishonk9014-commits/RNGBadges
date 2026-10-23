import type { BadgeDef } from '../types';
import { CALENDAR } from './calendar';
import { CULTURE } from './culture';
import { EQUATIONS, FUNNY } from './funny';
import { numberTheoryBadges, PATTERNS, POKER } from './properties';
import { HISTORY, SCIENCE } from './scienceHistory';
import { META, SPECIAL } from './special';
import { CALCULATOR, PHONE_WORDS } from './words';

let cached: BadgeDef[] | null = null;

/** Every badge definition in the game, validated. Built once. */
export function allBadgeDefs(): BadgeDef[] {
  if (cached) return cached;
  const defs = [
    ...FUNNY,
    ...EQUATIONS,
    ...CULTURE,
    ...SCIENCE,
    ...HISTORY,
    ...CALCULATOR,
    ...PHONE_WORDS,
    ...numberTheoryBadges(),
    ...POKER,
    ...PATTERNS,
    ...CALENDAR,
    ...SPECIAL,
    ...META,
  ];
  validateDefs(defs);
  cached = defs;
  return defs;
}

/** Throws on anything that would make two badges indistinguishable or a rule unmatchable. */
export function validateDefs(defs: readonly BadgeDef[]): void {
  const ids = new Set<string>();
  const names = new Map<string, string>();
  const rules = new Map<string, string>();
  const problems: string[] = [];

  for (const def of defs) {
    if (!/^[a-z0-9]+(\.[a-z0-9-]+)+$/.test(def.id)) problems.push(`${def.id}: id must look like "category.some-name"`);
    if (ids.has(def.id)) problems.push(`${def.id}: duplicate id`);
    ids.add(def.id);

    const nameKey = def.name.trim().toLowerCase();
    if (!nameKey) problems.push(`${def.id}: empty name`);
    const clash = names.get(nameKey);
    if (clash) problems.push(`${def.id}: name "${def.name}" already used by ${clash}`);
    names.set(nameKey, def.id);
    if (!def.description.trim()) problems.push(`${def.id}: empty description`);

    const { rule } = def;
    let ruleKey: string | null = null;
    switch (rule.kind) {
      case 'contains':
      case 'startsWith':
      case 'endsWith':
      case 'exact':
        if (!/^\d+$/.test(rule.value)) problems.push(`${def.id}: ${rule.kind} value must be digits`);
        ruleKey = `${rule.kind}:${rule.value}`;
        break;
      case 'mask':
        if (!/^[\d_]+$/.test(rule.mask) || !/\d/.test(rule.mask)) problems.push(`${def.id}: bad mask "${rule.mask}"`);
        ruleKey = `mask:${rule.mask}`;
        break;
      case 'values':
        if (rule.values.length === 0) problems.push(`${def.id}: empty value set`);
        ruleKey = `values:${[...new Set(rule.values)].sort((a, b) => a - b).join(',')}`;
        break;
      case 'skips':
        ruleKey = `skips:${rule.count}`;
        break;
      case 'context':
        if (!(rule.probability > 0 && rule.probability < 1)) problems.push(`${def.id}: context probability must be in (0, 1)`);
        break;
      case 'test':
        break;
    }
    if (ruleKey) {
      const dup = rules.get(ruleKey);
      if (dup) problems.push(`${def.id}: same rule as ${dup} (${ruleKey})`);
      rules.set(ruleKey, def.id);
    }
  }
  if (problems.length) throw new Error(`Invalid badge catalog:\n  ${problems.join('\n  ')}`);
}
