/**
 * Source of uniform random integers. The server uses a crypto-backed source,
 * the browser game uses Web Crypto, and tests, odds checks and the balance
 * report use the seeded one below.
 */
export interface RandomSource {
  /** Uniform integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
}

/** Small, fast, seedable PRNG (sfc32). Not for production rolls. */
export function seededRandom(seed: number): RandomSource {
  let a = 0x9e3779b9 ^ seed;
  let b = 0x243f6a88 ^ (seed * 31);
  let c = 0xb7e15162 ^ (seed * 131);
  let d = 1;
  const next = (): number => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    const t = (a + b + d) >>> 0;
    d = (d + 1) >>> 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) >>> 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) >>> 0;
    return t / 4294967296;
  };
  for (let i = 0; i < 16; i++) next();
  return {
    int(maxExclusive: number): number {
      return Math.floor(next() * maxExclusive);
    },
  };
}

/** Uniform integers from the Web Crypto API (browsers, and Node's globalThis.crypto), without modulo bias. */
export const webCryptoRandom: RandomSource = {
  int(maxExclusive: number): number {
    const limit = Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive;
    const buf = new Uint32Array(1);
    do globalThis.crypto.getRandomValues(buf);
    while (buf[0]! >= limit);
    return buf[0]! % maxExclusive;
  },
};
