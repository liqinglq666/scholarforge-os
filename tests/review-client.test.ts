import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildReviewRequest,
  createReviewAnalysisRun,
} from '@/lib/review/client';
import type { ReviewResult } from '@/lib/types';
import {
  createDraft,
  createPersistedWorkspace,
  createUserPreferences,
  createWorkspaceState,
} from '@/lib/workspace/schema';

function createData() {
  const draft = createDraft({
    projectName: 'Analysis client test',
    taskType: 'polish',
    sectionType: 'results',
    targetJournal: 'Test Journal',
    sourceText: 'The compressive strength was 42.5 MPa after 28 days. '.repeat(2),
    terminologyLocks: [{ id: 'term-1', source: 'neural net', preferred: 'neural network' }],
  });
  return {
    ...createPersistedWorkspace(),
    current: createWorkspaceState(draft),
    preferences: createUserPreferences({
      discipline: 'materials science',
      academicStage: 'doctoral',
      englishVariant: 'uk',
      explanationLevel: 'detailed',
    }),
  };
}

function createResult(taskId: string): ReviewResult {
  return {
    id: 'result-1',
    taskId,
    summary: 'One conservative wording suggestion.',
    suggestedText: 'The compressive strength was 42.5 MPa after 28 days.',
    issues: [{
      id: 'issue-1',
      category: 'Language',
      severity: 'minor',
      location: 'Sentence 1',
      original: 'was 42.5 MPa',
      revised: 'reached 42.5 MPa',
      reason: 'Conservative wording improvement.',
      meaningChanged: false,
      authorActionRequired: false,
      safeToApply: true,
    }],
    warnings: [],
    generatedAt: new Date().toISOString(),
  };
}

function abortableNeverFetch(): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  return (_input, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      reject(error);
    }, { once: true });
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('review analysis client', () => {
  it('builds the review request from the current draft and reusable preferences', () => {
    const data = createData();

    const request = buildReviewRequest(data);

    expect(request.taskId).toBe(data.current.draft.id);
    expect(request.text).toBe(data.current.draft.sourceText);
    expect(request.taskType).toBe('polish');
    expect(request.sectionType).toBe('results');
    expect(request.targetJournal).toBe('Test Journal');
    expect(request.terminologyLocks).toEqual(data.current.draft.terminologyLocks);
    expect(request.discipline).toBe('materials science');
    expect(request.academicStage).toBe('doctoral');
    expect(request.englishVariant).toBe('uk');
    expect(request.explanationLevel).toBe('detailed');
  });

  it('moves through stages, validates the task, and archives a successful result', async () => {
    const data = createData();
    const result = createResult(data.current.draft.id);
    const stages: string[] = [];
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe('POST');
      expect((init?.headers as Record<string, string>)['X-ScholarForge-Session']).toBe(data.current.draft.id);
      const body = JSON.parse(String(init?.body)) as { taskId: string; text: string };
      expect(body.taskId).toBe(data.current.draft.id);
      expect(body.text).toBe(data.current.draft.sourceText);
      return new Response(JSON.stringify({ result }), { status: 200 });
    });

    const run = createReviewAnalysisRun(data, {
      fetcher,
      onStage: (stage) => stages.push(stage),
    });

    expect(run.startedData.current.status).toBe('analyzing');
    const outcome = await run.promise;

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error(outcome.message);
    expect(stages).toEqual(['preparing', 'reviewing', 'organizing']);
    expect(outcome.data.current.status).toBe('reviewing');
    expect(outcome.data.current.currentResult?.id).toBe(result.id);
    expect(outcome.data.current.decisions).toEqual({ 'issue-1': 'pending' });
    expect(outcome.data.current.workingText).toBe(data.current.draft.sourceText);
    expect(outcome.data.history).toHaveLength(1);
    expect(outcome.data.history[0].workspace.currentResult?.id).toBe(result.id);
  });

  it('rejects a result that belongs to a different task and preserves the manuscript', async () => {
    const data = createData();
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ result: createResult('other-task') }), { status: 200 }));

    const outcome = await createReviewAnalysisRun(data, { fetcher }).promise;

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('Expected task mismatch failure');
    expect(outcome.kind).toBe('request');
    expect(outcome.message).toContain('当前任务不匹配');
    expect(outcome.data.current.currentResult).toBeNull();
    expect(outcome.data.current.status).toBe('draft');
    expect(outcome.data.current.draft.sourceText).toBe(data.current.draft.sourceText);
    expect(outcome.data.history).toEqual(data.history);
  });

  it('returns a clear failure when the service response is not JSON', async () => {
    const data = createData();
    const fetcher = vi.fn(async () => new Response('<html>gateway error</html>', {
      status: 502,
      headers: { 'Content-Type': 'text/html' },
    }));

    const outcome = await createReviewAnalysisRun(data, { fetcher }).promise;

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('Expected invalid response failure');
    expect(outcome.kind).toBe('request');
    expect(outcome.message).toBe('分析服务返回了无法解析的响应，请稍后重试。');
    expect(outcome.data.current.draft.sourceText).toBe(data.current.draft.sourceText);
  });

  it('distinguishes client timeout from a normal request failure', async () => {
    vi.useFakeTimers();
    const data = createData();
    const run = createReviewAnalysisRun(data, {
      fetcher: abortableNeverFetch(),
      timeoutMs: 25,
    });

    await vi.advanceTimersByTimeAsync(25);
    const outcome = await run.promise;

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('Expected timeout failure');
    expect(outcome.kind).toBe('timeout');
    expect(outcome.message).toContain('分析等待超过 65 秒');
    expect(outcome.data.current.status).toBe('draft');
    expect(outcome.data.current.draft.sourceText).toBe(data.current.draft.sourceText);
  });

  it('distinguishes an explicit user cancellation from timeout', async () => {
    const data = createData();
    const run = createReviewAnalysisRun(data, {
      fetcher: abortableNeverFetch(),
      timeoutMs: 60_000,
    });

    run.cancel();
    const outcome = await run.promise;

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('Expected cancellation failure');
    expect(outcome.kind).toBe('cancelled');
    expect(outcome.message).toBe('分析已取消。原文和设置仍保存在此浏览器中。');
    expect(outcome.data.current.draft.sourceText).toBe(data.current.draft.sourceText);
  });
});
