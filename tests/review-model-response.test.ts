import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reviewWithModel } from '@/lib/review/model';
import type { ReviewRequest } from '@/lib/types';

const originalApiKey = process.env.DASHSCOPE_API_KEY;
const originalBaseUrl = process.env.DASHSCOPE_BASE_URL;
const originalModel = process.env.DASHSCOPE_MODEL;

function request(): ReviewRequest {
  return {
    taskId: 'task-provider-response',
    projectName: 'Provider response test',
    taskType: 'polish',
    sectionType: 'results',
    targetJournal: '',
    text: 'The measured compressive strength was 42.5 MPa after 28 days. '.repeat(2),
    terminologyLocks: [],
    discipline: 'materials science',
    academicStage: 'doctoral',
    englishVariant: 'us',
    explanationLevel: 'balanced',
  };
}

beforeEach(() => {
  process.env.DASHSCOPE_API_KEY = 'test-key';
  process.env.DASHSCOPE_BASE_URL = 'https://provider.example/v1';
  process.env.DASHSCOPE_MODEL = 'test-model';
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (originalApiKey === undefined) delete process.env.DASHSCOPE_API_KEY;
  else process.env.DASHSCOPE_API_KEY = originalApiKey;
  if (originalBaseUrl === undefined) delete process.env.DASHSCOPE_BASE_URL;
  else process.env.DASHSCOPE_BASE_URL = originalBaseUrl;
  if (originalModel === undefined) delete process.env.DASHSCOPE_MODEL;
  else process.env.DASHSCOPE_MODEL = originalModel;
});

describe('review model provider response handling', () => {
  it('rejects a 200 response whose body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>upstream gateway page</html>', { status: 200 })));

    await expect(reviewWithModel(request())).rejects.toMatchObject({
      code: 'INVALID_PROVIDER_RESPONSE',
      status: 502,
      message: '模型服务返回了无法解析的响应。',
    });
  });

  it('rejects a JSON response with an invalid top-level structure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(['unexpected']), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })));

    await expect(reviewWithModel(request())).rejects.toMatchObject({
      code: 'INVALID_PROVIDER_RESPONSE',
      status: 502,
    });
  });

  it('rejects provider output that ended for a non-normal finish reason', async () => {
    const content = JSON.stringify({
      summary: 'Provider stopped before a normal completion.',
      suggestedText: request().text,
      issues: [],
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      choices: [{ finish_reason: 'content_filter', message: { content } }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })));

    await expect(reviewWithModel(request())).rejects.toMatchObject({
      code: 'MODEL_OUTPUT_INCOMPLETE',
      status: 502,
      message: '模型响应未正常结束，请稍后重试。',
    });
  });

  it('continues to normalize a normally stopped JSON response', async () => {
    const reviewRequest = request();
    const content = JSON.stringify({
      summary: 'No unsafe change was required.',
      suggestedText: reviewRequest.text,
      issues: [],
    });
    let capturedInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('https://provider.example/v1/chat/completions');
      capturedInit = init;
      return new Response(JSON.stringify({
        choices: [{ finish_reason: 'stop', message: { content } }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await reviewWithModel(reviewRequest);

    expect(result.taskId).toBe(reviewRequest.taskId);
    expect(result.summary).toBe('No unsafe change was required.');
    expect(result.suggestedText).toBe(reviewRequest.text.trim());
    expect(result.safetyGate).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((capturedInit?.headers as Record<string, string>).Authorization).toBe('Bearer test-key');
    expect(String(capturedInit?.body)).not.toContain('test-key');
  });
});
