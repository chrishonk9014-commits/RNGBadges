import type { BadgeDef, RollFacts } from '../types';
import {
  CATALAN,
  FACTORIALS,
  FERMAT_PRIMES,
  FIBONACCI,
  MERSENNE_PRIMES,
  POWERS_OF_TWO,
  highlyComposite,
  isAutomorphic,
  isHappy,
  isKaprekar,
  isNarcissistic,
  isPalindrome,
  isPerfectPower,
  isPrime,
  isTwinPrime,
  perfectNumbers,
  taxicabNumbers,
  VALUE_LIMIT,
} from '../numberTheory';

const six = (f: RollFacts): boolean => f.length === 6;

function powersUpTo(k: number): number[] {
  const out: number[] = [];
  for (let b = 0; b ** k <= VALUE_LIMIT; b++) out.push(b ** k);
  return out;
}

function lazySetTest(build: () => readonly number[]): (f: RollFacts) => boolean {
  let set: Set<number> | null = null;
  return (f) => (set ??= new Set(build())).has(f.value);
}

function triangulars(): number[] {
  const out: number[] = [];
  for (let k = 0; (k * (k + 1)) / 2 <= VALUE_LIMIT; k++) out.push((k * (k + 1)) / 2);
  return out;
}

/** Properties of the roll's value as a number. */
export function numberTheoryBadges(): BadgeDef[] {
  const nt = (
    id: string,
    name: string,
    description: string,
    flavor: string,
    rule: BadgeDef['rule'],
  ): BadgeDef => ({ id: `math.${id}`, name, description, flavor, category: 'math', rule });

  return [
    nt('prime', 'Prime Time', 'The roll is a prime number.', 'Divisible by nothing but 1 and itself.', {
      kind: 'test',
      test: (f) => isPrime(f.value),
    }),
    nt('twin-prime', 'Twin Prime', 'The roll is prime, and so is the number 2 above or below it.', 'Primes travel in pairs sometimes.', {
      kind: 'test',
      test: (f) => isTwinPrime(f.value),
    }),
    nt(
      'palindromic-prime',
      'Palindromic Prime',
      'The roll is prime and reads the same backwards (ignoring leading zeros).',
      'Prime from both directions.',
      { kind: 'test', test: (f) => isPrime(f.value) && isPalindrome(String(f.value)) },
    ),
    nt('mersenne', 'Mersenne Prime', 'The roll is a prime of the form 2ⁿ − 1 (3, 7, 31, 127, 8191, 131071, 524287).', 'Monks have hunted these for centuries.', {
      kind: 'values',
      values: MERSENNE_PRIMES,
    }),
    nt('fermat', 'Fermat Prime', 'The roll is a prime of the form 2^(2ⁿ) + 1 (3, 5, 17, 257, 65537).', 'Only five are known. Ever.', {
      kind: 'values',
      values: FERMAT_PRIMES,
    }),
    nt('square', 'Perfect Square', 'The roll is a perfect square.', 'n × n, no remainder.', { kind: 'values', values: powersUpTo(2) }),
    nt('cube', 'Perfect Cube', 'The roll is a perfect cube.', 'n × n × n.', { kind: 'values', values: powersUpTo(3) }),
    nt('fifth-power', 'Perfect Fifth', 'The roll is a perfect fifth power (0, 1, 32, 243, … 759375).', 'A musical interval, mathematically.', {
      kind: 'values',
      values: powersUpTo(5),
    }),
    nt('sixth-power', 'Sixth Sense', 'The roll is a perfect sixth power (a square and a cube at once).', 'I see perfect powers.', {
      kind: 'values',
      values: powersUpTo(6),
    }),
    nt('power-of-two', 'Power of Two', 'The roll is a power of two (1, 2, 4, … 524288).', 'Computers love these.', {
      kind: 'values',
      values: POWERS_OF_TWO,
    }),
    nt('fibonacci', 'Fibonacci Number', 'The roll is a Fibonacci number (0, 1, 2, 3, 5, 8, … 832040).', 'Sunflowers approve.', {
      kind: 'values',
      values: FIBONACCI,
    }),
    nt('triangular', 'Triangular', 'The roll is a triangular number (1 + 2 + … + n).', 'Bowling pins agree.', {
      kind: 'values',
      values: triangulars(),
    }),
    nt('factorial', 'Factorial!', 'The roll is a factorial (1, 2, 6, 24, 120, 720, 5040, 40320, 362880).', 'Exclamation mark included.', {
      kind: 'values',
      values: FACTORIALS,
    }),
    // Both divisor-based sets need a sieve over a million numbers, so they are
    // built on the first roll that asks rather than when the catalog loads.
    nt('perfect-number', 'Perfect Number', 'The roll equals the sum of its own divisors (6, 28, 496, 8128).', 'Only four exist below a million.', {
      kind: 'test',
      test: lazySetTest(perfectNumbers),
    }),
    nt('catalan', 'Catalan Number', 'The roll is a Catalan number (1, 2, 5, 14, 42, 132, …).', 'Counting brackets, trees and handshakes.', {
      kind: 'values',
      values: CATALAN,
    }),
    nt(
      'highly-composite',
      'Highly Composite',
      'The roll has more divisors than every smaller number (… 720, 5040, 720720).',
      'The opposite of a prime.',
      { kind: 'test', test: lazySetTest(highlyComposite) },
    ),
    nt('taxicab', 'Cab Fare', 'The roll is a sum of two positive cubes in two different ways.', 'Ramanujan would have noticed.', {
      kind: 'values',
      values: taxicabNumbers(),
    }),
    nt(
      'narcissistic',
      'Narcissist',
      'Each digit raised to the number of digits adds back up to the roll (153 = 1³ + 5³ + 3³).',
      'In love with its own digits.',
      { kind: 'test', test: (f) => isNarcissistic(f.value) },
    ),
    nt('automorphic', 'Automorphic', "The roll's square ends in the roll itself (376² = 141376).", 'It shows up in its own reflection.', {
      kind: 'test',
      test: (f) => isAutomorphic(f.value),
    }),
    nt('kaprekar', 'Kaprekar Number', "Split the roll's square in two and the halves add back to the roll (45² = 2025 → 20 + 25).", 'Square, split, sum, smile.', {
      kind: 'test',
      test: (f) => isKaprekar(f.value),
    }),
    nt(
      'mirror-square',
      'Mirror Square',
      'A perfect square that reads the same backwards (121, 484, 12321, …).',
      'Symmetric in every sense.',
      { kind: 'test', test: (f) => f.value >= 10 && isPerfectPower(f.value, 2) && isPalindrome(String(f.value)) },
    ),
    nt('harshad', 'Harshad Number', 'The roll is divisible by the sum of its digits.', 'Sanskrit for "joy-giver".', {
      kind: 'test',
      test: (f) => f.sum > 0 && f.value % f.sum === 0,
    }),
    nt('happy', 'Happy Number', 'Keep summing the squares of the digits and you reach 1.', ':)', {
      kind: 'test',
      test: (f) => isHappy(f.value),
    }),
    nt(
      'self-divisible',
      'Self-Divisible',
      'No zeros, and the roll is divisible by every one of its digits.',
      'Respects every digit it has.',
      {
        kind: 'test',
        test: (f) => {
          if (!six(f) || f.counts[0]! > 0) return false;
          for (let d = 2; d <= 9; d++) if (f.counts[d]! > 0 && f.value % d !== 0) return false;
          return true;
        },
      },
    ),
    nt('blackjack', 'Blackjack', 'The digits add up to exactly 21.', 'Hit me.', { kind: 'test', test: (f) => six(f) && f.sum === 21 }),
    nt('sum-equals-product', 'Balanced Books', 'The digits add up to the same total they multiply to (111126: 12 = 12).', 'The accountants are thrilled.', {
      kind: 'test',
      test: (f) => {
        if (!six(f) || f.sum === 0) return false;
        let product = 1;
        for (const ch of f.digits) product *= Number(ch);
        return product === f.sum;
      },
    }),
  ];
}

/** Poker hands made of the six digits. A roll has exactly one hand shape. */
export const POKER: BadgeDef[] = (
  [
    ['two-pair', 'Two Pair', '2-2-1-1', 'Two digits appear twice each and the other two are different (331788).', 'Not bad, not great.'],
    ['three-kind', 'Three of a Kind', '3-1-1-1', 'One digit appears exactly three times; the rest are all different.', 'Trips.'],
    ['three-pair', 'Three Pair', '2-2-2', 'Three different digits, each appearing exactly twice.', 'Pairs all the way down.'],
    ['full-house', 'Full House', '3-2-1', 'One digit three times, another twice, and one loner.', 'Full house, full heart.'],
    ['four-kind', 'Four of a Kind', '4-1-1', 'One digit appears exactly four times.', 'Quads!'],
    ['two-triples', 'Two Triples', '3-3', 'Two different digits, three of each.', 'Double trouble.'],
    ['full-mansion', 'Full Mansion', '4-2', 'One digit four times and another digit twice.', 'A full house with a guest wing.'],
    ['five-kind', 'Five of a Kind', '5-1', 'One digit appears five times.', 'Not possible in real poker. Possible here.'],
    ['six-kind', 'Six of a Kind', '6', 'All six digits are the same.', 'A repdigit. Rarer than a royal flush.'],
    ['no-repeats', 'No Repeats', '1-1-1-1-1-1', 'Six different digits, none repeated.', 'Every digit unique.'],
  ] as const
).map(([key, name, shape, description, flavor]) => ({
  id: `poker.${key}`,
  name,
  description,
  flavor,
  category: 'poker' as const,
  rule: { kind: 'test' as const, test: (f: RollFacts) => six(f) && f.shape === shape },
}));

POKER.push({
  id: 'poker.straight',
  name: 'Straight',
  description: 'Six consecutive digits, in any order (e.g. 352461).',
  flavor: 'Shuffled, but complete.',
  category: 'poker',
  rule: {
    kind: 'test',
    test: (f) => {
      if (!six(f) || f.distinct !== 6) return false;
      let lo = 9;
      let hi = 0;
      for (let d = 0; d <= 9; d++) {
        if (f.counts[d]) {
          lo = Math.min(lo, d);
          hi = Math.max(hi, d);
        }
      }
      return hi - lo === 5;
    },
  },
});

function steps(digits: string): number[] {
  const out: number[] = [];
  for (let i = 1; i < digits.length; i++) out.push(digits.charCodeAt(i) - digits.charCodeAt(i - 1));
  return out;
}

const allDigitsIn = (allowed: string) => (f: RollFacts) => six(f) && [...f.digits].every((d) => allowed.includes(d));

/** Numeric keypad (7-8-9 on top, 0 is the wide key under 1 and 2), king-move adjacency. */
const NUMPAD: Record<string, string> = {
  '7': '845',
  '8': '79456',
  '9': '856',
  '4': '78512',
  '5': '78946123',
  '6': '89523',
  '1': '4520',
  '2': '456130',
  '3': '5620',
  '0': '123',
};

/** Knight moves on a phone keypad (1-2-3 on top, 0 under 8). */
const KNIGHT: Record<string, string> = {
  '1': '68',
  '2': '79',
  '3': '48',
  '4': '390',
  '5': '',
  '6': '170',
  '7': '26',
  '8': '13',
  '9': '24',
  '0': '46',
};

function walks(graph: Record<string, string>) {
  return (f: RollFacts): boolean => {
    if (!six(f)) return false;
    for (let i = 1; i < 6; i++) if (!graph[f.digits[i - 1]!]!.includes(f.digits[i]!)) return false;
    return true;
  };
}

export const PATTERNS: BadgeDef[] = [
  ['palindrome', 'Palindrome', 'The roll reads the same forwards and backwards (123321).', 'Racecar energy.', (f: RollFacts) => six(f) && isPalindrome(f.digits)],
  ['echo', 'Echo', 'The first three digits repeat (472472).', 'Echo… echo…', (f: RollFacts) => six(f) && f.digits.slice(0, 3) === f.digits.slice(3)],
  ['ping-pong', 'Ping Pong', 'Two digits alternate all the way (474747).', 'Back and forth.', (f: RollFacts) => six(f) && f.digits === f.digits.slice(0, 2).repeat(3)],
  ['couples', 'Couples', 'Three pairs of side-by-side twins (113355).', 'Everyone brought a date.', (f: RollFacts) => six(f) && f.digits[0] === f.digits[1] && f.digits[2] === f.digits[3] && f.digits[4] === f.digits[5]],
  ['two-towers', 'Two Towers', 'Three of one digit, then three of another (222888).', 'One does not simply roll this.', (f: RollFacts) => six(f) && /^(\d)\1\1(\d)\2\2$/.test(f.digits)],
  ['bookends', 'Bookends', 'The first and last digits match.', 'Holding it all together.', (f: RollFacts) => six(f) && f.digits[0] === f.digits[5]],
  ['sandwich', 'Sandwich', 'The roll starts and ends with the same two digits (47xx47).', 'Same bread, any filling.', (f: RollFacts) => six(f) && f.digits.slice(0, 2) === f.digits.slice(4)],
  ['lucky-ticket', 'Lucky Ticket', 'The first three digits add up to the same as the last three.', 'Eat the ticket for good luck (old bus-ticket tradition).', (f: RollFacts) => six(f) && digitSum(f.digits.slice(0, 3)) === digitSum(f.digits.slice(3))],
  ['stairway-up', 'Stairway Up', 'Every digit is bigger than the one before it (135789).', 'Always climbing.', (f: RollFacts) => six(f) && steps(f.digits).every((s) => s > 0)],
  ['stairway-down', 'Stairway Down', 'Every digit is smaller than the one before it.', 'All downhill from here.', (f: RollFacts) => six(f) && steps(f.digits).every((s) => s < 0)],
  ['full-straight', 'Full Straight', 'Six digits counting up by one (012345, 123456 … 456789).', 'In perfect order.', (f: RollFacts) => six(f) && steps(f.digits).every((s) => s === 1)],
  ['countdown', 'Countdown', 'Six digits counting down by one (987654 … 543210).', 'T-minus six.', (f: RollFacts) => six(f) && steps(f.digits).every((s) => s === -1)],
  ['mountain', 'Mountain Peak', 'Digits strictly climb to a peak, then strictly fall (135420).', 'The view from the top.', (f: RollFacts) => six(f) && peaked(steps(f.digits), 1)],
  ['valley', 'Valley', 'Digits strictly fall to a low point, then strictly climb (842136).', 'Down, then back up.', (f: RollFacts) => six(f) && peaked(steps(f.digits), -1)],
  ['zigzag', 'Zigzag', 'Every step switches direction: up, down, up, down, up (or the reverse).', 'Never the same way twice.', (f: RollFacts) => six(f) && zigzag(steps(f.digits))],
  ['clockwork', 'Clockwork', 'Every digit is the last one plus the same step, wrapping 9 → 0 (147036).', 'Tick, tick, tick.', (f: RollFacts) => six(f) && clockwork(f.digits)],
  ['even-steven', 'Even Steven', 'Every digit is even.', 'Nothing odd about it.', allDigitsIn('02468')],
  ['odd-squad', 'Odd Squad', 'Every digit is odd.', 'Strange, but consistent.', allDigitsIn('13579')],
  ['high-roller', 'High Roller', 'Every digit is 5 or higher.', 'Big digits only.', allDigitsIn('56789')],
  ['low-roller', 'Low Roller', 'Every digit is 4 or lower.', 'Keeping it humble.', allDigitsIn('01234')],
  ['prime-digits', 'Prime Digits', 'Every digit is prime (2, 3, 5 or 7).', 'Prime, all the way down.', allDigitsIn('2357')],
  ['ones-and-zeros', 'Ones and Zeros', 'Only the digits 0 and 1 appear.', 'Speaking machine.', allDigitsIn('01')],
  ['numpad-walk', 'Numpad Walk', 'Each digit is a neighbouring key of the one before it on a numeric keypad.', 'Typed with one lazy finger.', walks(NUMPAD)],
  ['knights-tour', "Knight's Tour", "Each digit is a chess knight's move from the one before it on a phone keypad.", 'L-shaped dialling.', walks(KNIGHT)],
].map(([key, name, description, flavor, test]) => ({
  id: `pattern.${key as string}`,
  name: name as string,
  description: description as string,
  flavor: flavor as string,
  category: 'pattern' as const,
  rule: { kind: 'test' as const, test: test as (f: RollFacts) => boolean },
}));

/** Leading and trailing zeros: deliberately tiered, the more zeros the rarer. */
PATTERNS.push(
  ...(
    [
      ['lead-1', 'Leading Zero', '0', 'The roll starts with 0 (under 100,000).', 'A humble beginning.'],
      ['lead-2', 'Double-O', '00', 'The roll starts with 00 (under 10,000).', 'License pending.'],
      ['lead-3', 'Pocket Change', '000', 'The roll starts with 000 (under 1,000).', 'Small, but it’s yours.'],
      ['lead-4', 'Pennies', '0000', 'The roll starts with 0000 (under 100).', 'Tiny.'],
      ['lead-5', 'Single Digit', '00000', 'The roll starts with 00000 (under 10).', 'Five zeros of suspense.'],
    ] as const
  ).map(([key, name, value, description, flavor]) => ({
    id: `pattern.${key}`,
    name,
    description,
    flavor,
    category: 'pattern' as const,
    family: 'pattern.leading-zeros',
    rule: { kind: 'startsWith' as const, value },
  })),
  ...(
    [
      ['round-1', 'Round Number', '0', 'The roll ends in 0.', 'Nice and tidy.'],
      ['round-2', 'Very Round', '00', 'The roll ends in 00.', 'Even tidier.'],
      ['round-3', 'Grand', '000', 'The roll ends in 000.', 'A thousand of something.'],
      ['round-4', 'Ten Grand', '0000', 'The roll ends in 0000.', 'Stacks on stacks.'],
      ['round-5', 'Hundred Grand', '00000', 'The roll ends in 00000.', 'Almost suspiciously round.'],
    ] as const
  ).map(([key, name, value, description, flavor]) => ({
    id: `pattern.${key}`,
    name,
    description,
    flavor,
    category: 'pattern' as const,
    family: 'pattern.trailing-zeros',
    rule: { kind: 'endsWith' as const, value },
  })),
);

function digitSum(s: string): number {
  let t = 0;
  for (const ch of s) t += ch.charCodeAt(0) - 48;
  return t;
}

/** dir=1: strictly up then strictly down (mountain). dir=-1: the reverse (valley). */
function peaked(s: number[], dir: 1 | -1): boolean {
  let i = 0;
  while (i < s.length && s[i]! * dir > 0) i++;
  if (i === 0 || i === s.length) return false;
  while (i < s.length && s[i]! * dir < 0) i++;
  return i === s.length;
}

function zigzag(s: number[]): boolean {
  for (let i = 0; i < s.length; i++) {
    if (s[i] === 0) return false;
    if (i > 0 && Math.sign(s[i]!) === Math.sign(s[i - 1]!)) return false;
  }
  return true;
}

function clockwork(digits: string): boolean {
  const step = (digits.charCodeAt(1) - digits.charCodeAt(0) + 10) % 10;
  if (step === 0) return false;
  for (let i = 2; i < digits.length; i++) {
    if ((digits.charCodeAt(i) - digits.charCodeAt(i - 1) + 10) % 10 !== step) return false;
  }
  return true;
}

