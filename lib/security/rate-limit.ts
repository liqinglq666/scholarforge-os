interface Bucket {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 10 * 60 * 1000;
const REQUESTS_PER_SESSION = 8;
const REQUESTS_PER_IP = 40;
const MAX_CONCURRENT = 6;
const sessionBuckets = new Map<string, Bucket>();
const ipBuckets = new Map<string, Bucket>();
let activeRequests = 0;
let budgetDay = new Date().toISOString().slice(0, 10);
let dailyRequests = 0;

export interface RateLimitDecision {
  allowed: boolean;
  retryAfter: number;
  remaining: number;
  reason?: 'client' | 'concurrency' | 'budget';
}

function ipKey(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip') || 'anonymous-ip';
}

function sessionKey(request: Request) {
  const value = request.headers.get('x-scholarforge-session')?.trim();
  return value && /^[A-Za-z0-9_-]{8,100}$/.test(value) ? value : '';
}

function refreshBudgetDay(now: number) {
  const currentDay = new Date(now).toISOString().slice(0, 10);
  if (currentDay !== budgetDay) {
    budgetDay = currentDay;
    dailyRequests = 0;
  }
}

function consumeBucket(map: Map<string, Bucket>, key: string, limit: number, now: number) {
  const current = map.get(key);
  const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + WINDOW_MS } : current;
  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      remaining: 0,
    };
  }
  bucket.count += 1;
  map.set(key, bucket);
  return { allowed: true, retryAfter: 0, remaining: limit - bucket.count };
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

  const session = sessionKey(request);
  const sessionDecision = consumeBucket(
    session ? sessionBuckets : ipBuckets,
    session || ipKey(request),
    REQUESTS_PER_SESSION,
    now,
  );
  if (!sessionDecision.allowed) return { ...sessionDecision, reason: 'client' };

  if (session) {
    const ipDecision = consumeBucket(ipBuckets, ipKey(request), REQUESTS_PER_IP, now);
    if (!ipDecision.allowed) return { ...ipDecision, reason: 'client' };
  }

  dailyRequests += 1;
  activeRequests += 1;
  return sessionDecision;
}

export function releaseRateLimitSlot() {
  activeRequests = Math.max(0, activeRequests - 1);
}

export const RATE_LIMITS = {
  requestsPerWindow: REQUESTS_PER_SESSION,
  windowMinutes: WINDOW_MS / 60_000,
  maxConcurrent: MAX_CONCURRENT,
  requestsPerIpWindow: REQUESTS_PER_IP,
};

export function resetRateLimitForTests() {
  sessionBuckets.clear();
  ipBuckets.clear();
  activeRequests = 0;
  dailyRequests = 0;
}
