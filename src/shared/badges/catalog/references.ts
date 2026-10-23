import { pad6 } from '../../roll';
import type { BadgeDef, CategoryId } from '../types';

/**
 * A number reference ("007", "1337", "1969") is one identity that pays out
 * more the closer the roll gets to being just that number:
 *
 *   contains  — the reference appears anywhere      210074  (James Bond spotted)
 *   ends      — the roll ends in the reference      913007  (2–4 digit references)
 *   only      — the roll IS the reference            000007  (leading zeros only)
 *
 * Each tier is its own badge so a roll that hits "only" also reveals the two
 * lesser tiers on the way up, and XP stacks. Six-digit references have a
 * single exact badge; five-digit ones skip the "ends" tier because it would be
 * barely rarer than "contains".
 */
export interface ReferenceSpec {
  value: string;
  key: string;
  name: string;
  about: string;
  ends?: string;
  /** Name for the exact tier; '' when another reference already owns that exact roll. */
  only?: string;
  hidden?: boolean;
}

export type ReferenceRow = [value: string, key: string, name: string, about: string, ends?: string, only?: string];

export function rows(list: ReferenceRow[]): ReferenceSpec[] {
  return list.map(([value, key, name, about, ends, only]) => ({ value, key, name, about, ends, only }));
}

export interface TierNaming {
  ends: (name: string) => string;
  only: (name: string) => string;
}

const DEFAULT_NAMING: TierNaming = {
  ends: (name) => `${name} Finale`,
  only: (name) => `Only ${name}`,
};

export function referenceBadges(
  category: CategoryId,
  prefix: string,
  specs: ReferenceSpec[],
  naming: TierNaming = DEFAULT_NAMING,
): BadgeDef[] {
  const out: BadgeDef[] = [];
  for (const spec of specs) {
    const { value, key, name, about, hidden } = spec;
    if (!/^\d{2,6}$/.test(value)) throw new Error(`reference ${key}: value must be 2–6 digits, got "${value}"`);
    const family = `${prefix}.${key}`;
    const base = { category, flavor: about, family, hidden };

    if (value.length === 6) {
      out.push({ ...base, id: family, name, description: `The roll is exactly ${value}.`, rule: { kind: 'exact', value } });
      continue;
    }
    out.push({
      ...base,
      id: family,
      name,
      description: `The roll contains ${value} anywhere.`,
      rule: { kind: 'contains', value },
    });
    if (value.length <= 4) {
      out.push({
        ...base,
        id: `${family}.ends`,
        name: spec.ends ?? naming.ends(name),
        description: `The roll ends in ${value}.`,
        rule: { kind: 'endsWith', value },
      });
    }
    // An empty "only" name opts out, e.g. 0451 whose exact roll 000451 already belongs to 451.
    if (spec.only === '') continue;
    out.push({
      ...base,
      id: `${family}.only`,
      name: spec.only ?? naming.only(name),
      description: `The roll is exactly ${pad6(Number(value))} — nothing but ${value}.`,
      rule: { kind: 'exact', value: pad6(Number(value)) },
    });
  }
  return out;
}
