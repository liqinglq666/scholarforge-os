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

interface BucketCheck extends RateLimitDecision {
  bucket: Bucket;
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

function inspectBucket(map: Map<string, Bucket>, key: string, limit: number, now: number): BucketCheck {
  const current = map.get(key);
  const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + WINDOW_MS } : current;
  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      remaining: 0,
      bucket,
    };
  }
  return {
    allowed: true,
    retryAfter: 0,
    remaining: limit - bucket.count - 1,
    bucket,
  };
}

function commitBucket(map: Map<string, Bucket>, key: string, bucket: Bucket) {
  map.set(key, { ...bucket, count: bucket.count + 1 });
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
  const ip = ipKey(request);
  if (!session) {
    const anonymousDecision = inspectBucket(ipBuckets, ip, REQUESTS_PER_SESSION, now);
    if (!anonymousDecision.allowed) {
      return {
        allowed: false,
        retryAfter: anonymousDecision.retryAfter,
        remaining: 0,
        reason: 'client',
      };
    }
    commitBucket(ipBuckets, ip, anonymousDecision.bucket);
    dailyRequests += 1;
    activeRequests += 1;
    return {
      allowed: true,
      retryAfter: 0,
      remaining: anonymousDecision.remaining,
    };
  }

  const sessionDecision = inspectBucket(sessionBuckets, session, REQUESTS_PER_SESSION, now);
  if (!sessionDecision.allowed) {
    return {
      allowed: false,
      retryAfter: sessionDecision.retryAfter,
      remaining: 0,
      reason: 'client',
    };
  }

  const ipDecision = inspectBucket(ipBuckets, ip, REQUESTS_PER_IP, now);
  if (!ipDecision.allowed) {
    return {
      allowed: false,
      retryAfter: ipDecision.retryAfter,
      remaining: 0,
      reason: 'client',
    };
  }

  commitBucket(sessionBuckets, session, sessionDecision.bucket);
  commitBucket(ipBuckets, ip, ipDecision.bucket);
  dailyRequests += 1;
  activeRequests += 1;
  return {
    allowed: true,
    retryAfter: 0,
    remaining: sessionDecision.remaining,
  };
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
