import type { Roll } from '../roll';
import type { RollFacts } from './types';

export function computeFacts(roll: Roll): RollFacts {
  const { digits } = roll;
  const counts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const d = digits.charCodeAt(i) - 48;
    counts[d]!++;
    sum += d;
  }
  const multiplicities: number[] = [];
  for (const c of counts) if (c > 0) multiplicities.push(c);
  multiplicities.sort((a, b) => b - a);
  return {
    roll,
    digits,
    length: digits.length,
    value: digits.length === 0 ? -1 : Number(digits),
    counts,
    shape: multiplicities.join('-'),
    sum,
    distinct: multiplicities.length,
  };
}

/** Digits without leading zeros ("000420" → "420", "000000" → "0"). */
export function significant(digits: string): string {
  const trimmed = digits.replace(/^0+/, '');
  return trimmed === '' && digits.length > 0 ? '0' : trimmed;
}
