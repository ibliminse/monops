/**
 * Simple sliding-window rate limiter for serverless API routes.
 * Each Vercel function instance has its own memory, so this prevents
 * rapid-fire abuse from a single client within a warm instance.
 */

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const stores = new Map<string, Map<string, number[]>>();

export function rateLimit(
  key: string,
  ip: string,
  config: RateLimitConfig
): { limited: boolean; retryAfterMs: number } {
  if (!stores.has(key)) stores.set(key, new Map());
  const store = stores.get(key)!;

  const now = Date.now();
  const timestamps = (store.get(ip) || []).filter(t => t > now - config.windowMs);

  if (timestamps.length >= config.maxRequests) {
    const oldest = timestamps[0];
    return { limited: true, retryAfterMs: oldest + config.windowMs - now };
  }

  timestamps.push(now);
  store.set(ip, timestamps);

  // Probabilistic cleanup to prevent unbounded memory growth
  if (Math.random() < 0.01) {
    for (const [storedIp, storedTs] of store) {
      if (storedTs.every(t => t <= now - config.windowMs)) {
        store.delete(storedIp);
      }
    }
  }

  return { limited: false, retryAfterMs: 0 };
}

/**
 * Extract client IP from Next.js request headers.
 */
export function getClientIp(request: { headers: { get(name: string): string | null } }): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}
