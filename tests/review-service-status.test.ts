import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET as getHealth } from '@/app/api/health/route';
import { parseReviewServiceStatus } from '@/components/review/use-review-service-status';
import {
  MAX_REQUEST_BYTES,
  MAX_SOURCE_CHARACTERS,
  REVIEW_RATE_WINDOW_MINUTES,
  REVIEW_REQUESTS_PER_WINDOW,
} from '@/lib/config';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('review service status contract', () => {
  it('reports shared review limits and trims the effective model configuration', async () => {
    vi.stubEnv('DASHSCOPE_API_KEY', '  test-key  ');
    vi.stubEnv('DASHSCOPE_MODEL', '  qwen-plus  ');

    const response = getHealth();
    const payload = await response.json();

    expect(payload.configured).toBe(true);
    expect(payload.model).toBe('qwen-plus');
    expect(payload.limits).toEqual({
      maxCharacters: MAX_SOURCE_CHARACTERS,
      maxRequestBytes: MAX_REQUEST_BYTES,
      requestsPerWindow: REVIEW_REQUESTS_PER_WINDOW,
      windowMinutes: REVIEW_RATE_WINDOW_MINUTES,
    });
  });

  it('does not report a whitespace-only API key as configured', async () => {
    vi.stubEnv('DASHSCOPE_API_KEY', '   ');
    vi.stubEnv('DASHSCOPE_MODEL', 'qwen-plus');

    const payload = await getHealth().json();

    expect(payload.configured).toBe(false);
    expect(payload.model).toBeNull();
  });

  it('accepts only structurally valid health payloads before enabling analysis', () => {
    const valid = parseReviewServiceStatus({
      configured: true,
      model: '  qwen-plus  ',
      message: '分析服务已配置。',
      limits: {
        maxCharacters: 12_000,
        maxRequestBytes: 80_000,
        requestsPerWindow: 8,
        windowMinutes: 10,
      },
    });

    expect(valid?.model).toBe('qwen-plus');
    expect(parseReviewServiceStatus({
      configured: 'yes',
      model: 'qwen-plus',
      message: 'bad',
      limits: {
        maxCharacters: 12_000,
        maxRequestBytes: 80_000,
        requestsPerWindow: 8,
        windowMinutes: 10,
      },
    })).toBeNull();
    expect(parseReviewServiceStatus({
      configured: true,
      model: '',
      message: 'bad',
      limits: {
        maxCharacters: 12_000,
        maxRequestBytes: 80_000,
        requestsPerWindow: 0,
        windowMinutes: 10,
      },
    })).toBeNull();
  });
});
