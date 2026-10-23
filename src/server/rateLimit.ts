/** In-memory token buckets, one per key. Good for a single server process. */
export class RateLimiter {
  private readonly buckets = new Map<string, { tokens: number; at: number }>();

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Takes one token. Returns 0 when allowed, otherwise how many ms until the next token. */
  take(key: string): number {
    const t = this.now();
    const bucket = this.buckets.get(key) ?? { tokens: this.capacity, at: t };
    bucket.tokens = Math.min(this.capacity, bucket.tokens + ((t - bucket.at) / 1000) * this.refillPerSecond);
    bucket.at = t;
    this.buckets.set(key, bucket);
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      if (this.buckets.size > 50_000) this.prune(t);
      return 0;
    }
    return Math.ceil(((1 - bucket.tokens) / this.refillPerSecond) * 1000);
  }

  private prune(t: number): void {
    const full = (this.capacity / this.refillPerSecond) * 1000;
    for (const [key, b] of this.buckets) if (t - b.at > full) this.buckets.delete(key);
  }
}
