import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/review/route';
import { resetRateLimitForTests } from '@/lib/security/rate-limit';

const validBody = {
  taskId: 'api-test',
  projectName: 'API test',
  taskType: 'polish',
  sectionType: 'results',
  targetJournal: '',
  text: 'The strength was 42.5 MPa after 28 d, representing an increase of 12%.',
  terminologyLocks: [],
};

function request(body: string, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/review', { method: 'POST', body, headers: { 'content-type': 'application/json', ...headers } });
}

describe('POST /api/review', () => {
  beforeEach(() => {
    resetRateLimitForTests();
    delete process.env.DASHSCOPE_API_KEY;
  });

  afterEach(() => {
    delete process.env.DASHSCOPE_API_KEY;
    vi.unstubAllGlobals();
  });

  it('rejects invalid JSON and non-object JSON', async () => {
    expect((await POST(request('{bad'))).status).toBe(400);
    expect((await POST(request('[]'))).status).toBe(400);
  });

  it('returns 503 without generating simulated results when the model is not configured', async () => {
    const response = await POST(request(JSON.stringify(validBody)));
    const payload = await response.json();
    expect(response.status).toBe(503);
    expect(payload.code).toBe('SERVICE_NOT_CONFIGURED');
    expect(payload.result).toBeUndefined();
  });

  it('rejects an oversized request before parsing or model access', async () => {
    const response = await POST(request('{}', { 'content-length': '80001' }));
    expect(response.status).toBe(413);
    expect((await response.json()).code).toBe('REQUEST_TOO_LARGE');
  });

  it('returns a validated live result', async () => {
    process.env.DASHSCOPE_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ summary: 'Checked.', suggestedText: validBody.text, issues: [] }) } }],
    })));
    const response = await POST(request(JSON.stringify(validBody), { 'x-scholarforge-session': 'api-test-session' }));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.result.summary).toBe('Checked.');
    expect(payload.result.safetyGate.status).toBe('passed');
    expect(payload.result).not.toHaveProperty('agentRuns');
    expect(response.headers.get('x-ratelimit-remaining')).toBe('7');
  });

  it('rejects truncated model output', async () => {
    process.env.DASHSCOPE_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ choices: [{ finish_reason: 'length', message: { content: '{}' } }] })));
    const response = await POST(request(JSON.stringify(validBody)));
    expect(response.status).toBe(502);
    expect((await response.json()).code).toBe('MODEL_OUTPUT_TRUNCATED');
  });

  it('rejects non-JSON model output', async () => {
    process.env.DASHSCOPE_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ choices: [{ finish_reason: 'stop', message: { content: 'not json' } }] })));
    const response = await POST(request(JSON.stringify(validBody)));
    expect(response.status).toBe(502);
    expect((await response.json()).code).toBe('INVALID_MODEL_JSON');
  });

  it('returns an explainable quarantined result when scientific checks fail', async () => {
    process.env.DASHSCOPE_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ summary: 'Unsafe.', suggestedText: validBody.text.replace('42.5', '45.0'), issues: [] }) } }] })));
    const response = await POST(request(JSON.stringify(validBody)));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.result.safetyGate.status).toBe('quarantined');
    expect(payload.result.safetyGate.blockedCount).toBeGreaterThan(0);
    expect(payload.result.warnings.join(' ')).toMatch(/数值/);
  });

  it('enforces per-session rate limits and Retry-After', async () => {
    process.env.DASHSCOPE_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ summary: 'Checked.', suggestedText: validBody.text, issues: [] }) } }] })));
    for (let index = 0; index < 8; index += 1) {
      expect((await POST(request(JSON.stringify(validBody), { 'x-scholarforge-session': 'same-client-session' }))).status).toBe(200);
    }
    const limited = await POST(request(JSON.stringify(validBody), { 'x-scholarforge-session': 'same-client-session' }));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
  });
});
