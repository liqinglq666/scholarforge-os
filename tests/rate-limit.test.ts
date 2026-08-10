import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  checkRateLimit,
  releaseRateLimitSlot,
  resetRateLimitForTests,
} from '@/lib/security/rate-limit';

function request(ip: string, session?: string) {
  return new Request('http://localhost/api/review', {
    headers: {
      'x-forwarded-for': ip,
      ...(session ? { 'x-scholarforge-session': session } : {}),
    },
  });
}

const now = Date.UTC(2026, 7, 10, 9, 15, 0);

beforeEach(() => {
  resetRateLimitForTests();
  delete process.env.REVIEW_DAILY_REQUEST_BUDGET;
});

afterEach(() => {
  resetRateLimitForTests();
  delete process.env.REVIEW_DAILY_REQUEST_BUDGET;
});

describe('rate limit accounting', () => {
  it('does not consume session quota when the shared IP bucket rejects the request', () => {
    const saturatedIp = '203.0.113.10';
    for (let index = 0; index < 40; index += 1) {
      const decision = checkRateLimit(
        request(saturatedIp, `fill-session-${String(index).padStart(2, '0')}`),
        now,
      );
      expect(decision.allowed).toBe(true);
      releaseRateLimitSlot();
    }

    const targetSession = 'target-session-01';
    const rejectedByIp = checkRateLimit(request(saturatedIp, targetSession), now);
    expect(rejectedByIp.allowed).toBe(false);
    expect(rejectedByIp.reason).toBe('client');

    const freshIp = '198.51.100.20';
    for (let index = 0; index < 8; index += 1) {
      const decision = checkRateLimit(request(freshIp, targetSession), now);
      expect(decision.allowed, `target session request ${index + 1} should still be available`).toBe(true);
      expect(decision.remaining).toBe(7 - index);
      releaseRateLimitSlot();
    }

    const ninth = checkRateLimit(request(freshIp, targetSession), now);
    expect(ninth.allowed).toBe(false);
    expect(ninth.reason).toBe('client');
    expect(ninth.remaining).toBe(0);
  });

  it('keeps the anonymous per-IP limit at eight requests per window', () => {
    const ip = '192.0.2.44';
    for (let index = 0; index < 8; index += 1) {
      const decision = checkRateLimit(request(ip), now);
      expect(decision.allowed).toBe(true);
      expect(decision.remaining).toBe(7 - index);
      releaseRateLimitSlot();
    }

    const ninth = checkRateLimit(request(ip), now);
    expect(ninth.allowed).toBe(false);
    expect(ninth.reason).toBe('client');
    expect(ninth.retryAfter).toBeGreaterThan(0);
  });

  it('releases concurrency capacity after admitted requests complete', () => {
    const admitted = [];
    for (let index = 0; index < 6; index += 1) {
      admitted.push(checkRateLimit(request(`198.51.100.${index + 1}`, `concurrent-${index + 1}`), now));
    }
    expect(admitted.every((decision) => decision.allowed)).toBe(true);

    const blocked = checkRateLimit(request('198.51.100.99', 'concurrent-99'), now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toBe('concurrency');
    expect(blocked.retryAfter).toBe(15);

    releaseRateLimitSlot();
    const admittedAfterRelease = checkRateLimit(request('198.51.100.99', 'concurrent-99'), now);
    expect(admittedAfterRelease.allowed).toBe(true);

    for (let index = 0; index < 6; index += 1) releaseRateLimitSlot();
  });
});
