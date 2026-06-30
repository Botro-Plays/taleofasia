type RateEntry = {
  count: number;
  limit: number;
  resetTime: number;
};

export type BlockEvent = {
  timestamp: number;
  ip: string;
  key: string;
  retryAfter: number;
};

const MAX_RECENT_BLOCKS = 200;
export const recentBlocks: BlockEvent[] = [];

export function recordBlock(ip: string, key: string, retryAfter: number): void {
  recentBlocks.unshift({ timestamp: Date.now(), ip, key, retryAfter });
  if (recentBlocks.length > MAX_RECENT_BLOCKS) recentBlocks.splice(MAX_RECENT_BLOCKS);
}

class RateLimiter {
  private store = new Map<string, RateEntry>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(cleanupMs = 60000) {
    this.cleanupInterval = setInterval(() => this.cleanup(), cleanupMs);
  }

  check(ip: string, key: string, limit: number, windowMs: number) {
    const now = Date.now();
    const storeKey = `${ip}:${key}`;
    const entry = this.store.get(storeKey);

    if (!entry || now > entry.resetTime) {
      this.store.set(storeKey, { count: 1, limit, resetTime: now + windowMs });
      return { allowed: true as const };
    }

    if (entry.count >= limit) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      return { allowed: false as const, retryAfter };
    }

    entry.count++;
    return { allowed: true as const };
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }

  getAll(): Array<{ key: string; count: number; limit: number; resetTime: number; remaining: number; isBlocked: boolean }> {
    const now = Date.now();
    return Array.from(this.store.entries())
      .filter(([, e]) => now <= e.resetTime)
      .map(([key, e]) => ({
        key,
        count: e.count,
        limit: e.limit,
        resetTime: e.resetTime,
        remaining: Math.ceil((e.resetTime - now) / 1000),
        isBlocked: e.count >= e.limit,
      }))
      .sort((a, b) => b.count - a.count);
  }

  flush(filter?: string): number {
    let count = 0;
    if (!filter) {
      count = this.store.size;
      this.store.clear();
    } else {
      for (const key of this.store.keys()) {
        if (key.includes(filter)) {
          this.store.delete(key);
          count++;
        }
      }
    }
    return count;
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }
}

export const rateLimiter = new RateLimiter();

export function getClientIP(request: Request): string {
  // Cloudflare sends the real client IP in CF-Connecting-IP
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();

  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;

  return 'unknown';
}

export function rateLimitResponse(retryAfter: number) {
  return new Response(
    JSON.stringify({
      error: 'Too many requests. Please try again later.',
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
      },
    }
  );
}
