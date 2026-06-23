type CacheEntry<T> = {
  value?: T;
  expiresAt: number;
  promise?: Promise<T>;
};

const store = new Map<string, CacheEntry<any>>();

// Simple in-memory cache with TTL and in-flight de-duplication.
export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const existing = store.get(key);

  // Serve fresh cached value
  if (existing && existing.value !== undefined && existing.expiresAt > now) {
    return existing.value as T;
  }

  // Coalesce concurrent callers while a refresh is in-flight
  if (existing && existing.promise) {
    return existing.promise as Promise<T>;
  }

  const p = fn()
    .then((val) => {
      store.set(key, { value: val, expiresAt: Date.now() + ttlMs });
      return val;
    })
    .finally(() => {
      const e = store.get(key);
      if (e) delete e.promise;
    });

  store.set(key, { value: existing?.value, expiresAt: existing?.expiresAt ?? 0, promise: p });
  return p;
}

export function invalidate(keyPrefix: string) {
  for (const k of store.keys()) {
    if (k.startsWith(keyPrefix)) store.delete(k);
  }
}
