/**
 * Number-theory helpers for badge predicates. Every special set is generated
 * from its definition rather than typed in by hand, and tests cross-check the
 * well-known members.
 */
export const VALUE_LIMIT = 1_000_000;

let sieveCache: Uint8Array | null = null;

/** sieve[n] === 1 when n is prime, for 0 <= n <= VALUE_LIMIT + 2. */
function primeSieve(): Uint8Array {
  if (sieveCache) return sieveCache;
  const size = VALUE_LIMIT + 3;
  const s = new Uint8Array(size).fill(1);
  s[0] = 0;
  s[1] = 0;
  for (let i = 2; i * i < size; i++) {
    if (s[i]) for (let j = i * i; j < size; j += i) s[j] = 0;
  }
  sieveCache = s;
  return s;
}

export function isPrime(n: number): boolean {
  return n >= 2 && n <= VALUE_LIMIT + 2 && primeSieve()[n] === 1;
}

export function isTwinPrime(n: number): boolean {
  return isPrime(n) && (isPrime(n - 2) || isPrime(n + 2));
}

function integerRoot(n: number, k: number): number {
  let r = Math.round(n ** (1 / k));
  while (r ** k > n) r--;
  while ((r + 1) ** k <= n) r++;
  return r;
}

export function isPerfectPower(n: number, k: number): boolean {
  if (n < 0) return false;
  return integerRoot(n, k) ** k === n;
}

export function isTriangular(n: number): boolean {
  return n >= 0 && isPerfectPower(8 * n + 1, 2);
}

function sequenceUpTo(limit: number, next: (prev: number[], i: number) => number, seed: number[]): number[] {
  const out = [...seed];
  for (let i = out.length; ; i++) {
    const v = next(out, i);
    if (v > limit) break;
    out.push(v);
  }
  return out;
}

export const FIBONACCI: readonly number[] = [
  ...new Set(sequenceUpTo(VALUE_LIMIT, (p, i) => p[i - 1]! + p[i - 2]!, [0, 1])),
];

export const POWERS_OF_TWO: readonly number[] = sequenceUpTo(VALUE_LIMIT, (p, i) => p[i - 1]! * 2, [1]);

export const FACTORIALS: readonly number[] = [...new Set(sequenceUpTo(VALUE_LIMIT, (p, i) => p[i - 1]! * i, [1]))];

export const CATALAN: readonly number[] = [
  ...new Set(sequenceUpTo(VALUE_LIMIT, (p, i) => (p[i - 1]! * 2 * (2 * i - 1)) / (i + 1), [1])),
];

export const MERSENNE_PRIMES: readonly number[] = sequenceUpTo(VALUE_LIMIT, (_p, i) => 2 ** (i + 2) - 1, [3]).filter(
  isPrime,
);

export const FERMAT_PRIMES: readonly number[] = sequenceUpTo(VALUE_LIMIT, (_p, i) => 2 ** (2 ** i) + 1, [3]).filter(
  isPrime,
);

function divisorSums(limit: number): { count: Uint32Array; sum: Float64Array } {
  const count = new Uint32Array(limit + 1);
  const sum = new Float64Array(limit + 1);
  for (let i = 1; i <= limit; i++) {
    for (let j = i; j <= limit; j += i) {
      count[j]!++;
      sum[j]! += i;
    }
  }
  return { count, sum };
}

let divisorCache: { highlyComposite: number[]; perfect: number[] } | null = null;

function divisorSets(): { highlyComposite: number[]; perfect: number[] } {
  if (divisorCache) return divisorCache;
  const { count, sum } = divisorSums(VALUE_LIMIT);
  const highlyComposite: number[] = [];
  const perfect: number[] = [];
  let best = 0;
  for (let n = 1; n <= VALUE_LIMIT; n++) {
    if (count[n]! > best) {
      best = count[n]!;
      highlyComposite.push(n);
    }
    if (sum[n]! === 2 * n) perfect.push(n);
  }
  divisorCache = { highlyComposite, perfect };
  return divisorCache;
}

/** Numbers with more divisors than every smaller positive number. */
export function highlyComposite(): readonly number[] {
  return divisorSets().highlyComposite;
}

/** Numbers equal to the sum of their proper divisors. */
export function perfectNumbers(): readonly number[] {
  return divisorSets().perfect;
}

/** Sums of two positive cubes in at least two different ways. */
export function taxicabNumbers(): readonly number[] {
  const ways = new Map<number, number>();
  for (let a = 1; a ** 3 <= VALUE_LIMIT; a++) {
    for (let b = a; a ** 3 + b ** 3 <= VALUE_LIMIT; b++) {
      const n = a ** 3 + b ** 3;
      ways.set(n, (ways.get(n) ?? 0) + 1);
    }
  }
  return [...ways].filter(([, w]) => w >= 2).map(([n]) => n).sort((x, y) => x - y);
}

/** Equal to the sum of its digits, each raised to the number of digits (two digits or more). */
export function isNarcissistic(n: number): boolean {
  if (n < 10) return false;
  const s = String(n);
  let total = 0;
  for (const ch of s) total += Number(ch) ** s.length;
  return total === n;
}

/** n² ends in n (0 and 1 excluded as trivial). */
export function isAutomorphic(n: number): boolean {
  if (n < 2) return false;
  const mod = 10 ** String(n).length;
  return (n * n) % mod === n;
}

/** n² splits into a left and right part (right part non-zero) that add back up to n. */
export function isKaprekar(n: number): boolean {
  if (n < 2) return false;
  const mod = 10 ** String(n).length;
  const sq = n * n;
  const right = sq % mod;
  const left = Math.floor(sq / mod);
  return right > 0 && left + right === n;
}

const happyMemo = new Map<number, boolean>();

/** Repeatedly summing the squares of the digits eventually reaches 1. */
export function isHappy(n: number): boolean {
  if (n <= 0) return false;
  const seen: number[] = [];
  let x = n;
  while (x !== 1 && !seen.includes(x)) {
    const memo = happyMemo.get(x);
    if (memo !== undefined) {
      for (const s of seen) if (s < 1000) happyMemo.set(s, memo);
      return memo;
    }
    seen.push(x);
    let next = 0;
    while (x > 0) {
      const d = x % 10;
      next += d * d;
      x = Math.floor(x / 10);
    }
    x = next;
  }
  const happy = x === 1;
  for (const s of seen) if (s < 1000) happyMemo.set(s, happy);
  return happy;
}

export function isPalindrome(s: string): boolean {
  for (let i = 0, j = s.length - 1; i < j; i++, j--) if (s[i] !== s[j]) return false;
  return true;
}
