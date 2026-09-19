interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// In-memory sliding window rate limiter (serverless warm instance friendly)
const windowCounters = new Map<string, RateLimitRecord>();

export interface RateLimitOptions {
  windowMs: number; // Duration of rate limit window (e.g. 60000ms = 1 min)
  maxRequests: number; // Max requests allowed per window
}

export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = { windowMs: 60 * 1000, maxRequests: 30 }
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const current = windowCounters.get(identifier);

  if (!current || now > current.resetAt) {
    const resetAt = now + options.windowMs;
    windowCounters.set(identifier, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: options.maxRequests - 1,
      resetAt,
    };
  }

  if (current.count >= options.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: current.resetAt,
    };
  }

  current.count += 1;
  return {
    allowed: true,
    remaining: options.maxRequests - current.count,
    resetAt: current.resetAt,
  };
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "127.0.0.1";
}
