interface Bucket {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 10 * 60 * 1000;
const REQUESTS_PER_WINDOW = 6;
const MAX_CONCURRENT = 4;
const buckets = new Map<string, Bucket>();
let activeRequests = 0;
let budgetDay = new Date().toISOString().slice(0, 10);
let dailyRequests = 0;

export interface RateLimitDecision {
  allowed: boolean;
  retryAfter: number;
  remaining: number;
  reason?: 'client' | 'concurrency' | 'budget';
}

function clientKey(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip') || request.headers.get('x-scholarforge-session') || 'anonymous';
}

function refreshBudgetDay(now: number) {
  const currentDay = new Date(now).toISOString().slice(0, 10);
  if (currentDay !== budgetDay) {
    budgetDay = currentDay;
    dailyRequests = 0;
  }
}

export function checkRateLimit(request: Request, now = Date.now()): RateLimitDecision {
  refreshBudgetDay(now);
  const configuredBudget = Number.parseInt(process.env.REVIEW_DAILY_REQUEST_BUDGET || '0', 10);
  if (configuredBudget > 0 && dailyRequests >= configuredBudget) {
    return { allowed: false, retryAfter: 3600, remaining: 0, reason: 'budget' };
  }
  if (activeRequests >= MAX_CONCURRENT) {
    return { allowed: false, retryAfter: 15, remaining: 0, reason: 'concurrency' };
  }

  const key = clientKey(request);
  const current = buckets.get(key);
  const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + WINDOW_MS } : current;
  if (bucket.count >= REQUESTS_PER_WINDOW) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      remaining: 0,
      reason: 'client',
    };
  }
  bucket.count += 1;
  buckets.set(key, bucket);
  dailyRequests += 1;
  activeRequests += 1;
  return { allowed: true, retryAfter: 0, remaining: REQUESTS_PER_WINDOW - bucket.count };
}

export function releaseRateLimitSlot() {
  activeRequests = Math.max(0, activeRequests - 1);
}

export const RATE_LIMITS = {
  requestsPerWindow: REQUESTS_PER_WINDOW,
  windowMinutes: WINDOW_MS / 60_000,
  maxConcurrent: MAX_CONCURRENT,
};

export function resetRateLimitForTests() {
  buckets.clear();
  activeRequests = 0;
  dailyRequests = 0;
}
