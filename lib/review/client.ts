import { MAX_HISTORY_ENTRIES } from '@/lib/config';
import type {
  ApiErrorPayload,
  PersistedWorkspace,
  ReviewRequest,
  ReviewResult,
  WorkspaceState,
} from '@/lib/types';
import { createHistoryEntry } from '@/lib/workspace/schema';

export type AnalysisStage = 'preparing' | 'reviewing' | 'organizing';
export type AnalysisFailureKind = 'cancelled' | 'timeout' | 'request';

export const CLIENT_ANALYSIS_TIMEOUT_MS = 65_000;

interface FetchLike {
  (input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface ReviewAnalysisOptions {
  fetcher?: FetchLike;
  timeoutMs?: number;
  onStage?: (stage: AnalysisStage) => void;
}

export type ReviewAnalysisOutcome =
  | {
      ok: true;
      data: PersistedWorkspace;
      result: ReviewResult;
    }
  | {
      ok: false;
      data: PersistedWorkspace;
      kind: AnalysisFailureKind;
      message: string;
    };

export interface ReviewAnalysisRun {
  startedData: PersistedWorkspace;
  cancel: () => void;
  promise: Promise<ReviewAnalysisOutcome>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseReviewPayload(value: unknown): { result?: ReviewResult; error?: string } {
  if (!isRecord(value)) return {};
  const error = typeof value.error === 'string' ? value.error : undefined;
  if (!isRecord(value.result)) return { ...(error ? { error } : {}) };
  const result = value.result;
  if (
    typeof result.id !== 'string'
    || typeof result.taskId !== 'string'
    || typeof result.summary !== 'string'
    || typeof result.suggestedText !== 'string'
    || !Array.isArray(result.issues)
    || !Array.isArray(result.warnings)
    || typeof result.generatedAt !== 'string'
  ) {
    return { ...(error ? { error } : {}) };
  }
  return { result: result as unknown as ReviewResult, ...(error ? { error } : {}) };
}

export function buildReviewRequest(data: PersistedWorkspace): ReviewRequest {
  const draft = data.current.draft;
  return {
    taskId: draft.id,
    projectName: draft.projectName,
    taskType: draft.taskType,
    sectionType: draft.sectionType,
    targetJournal: draft.targetJournal,
    text: draft.sourceText,
    terminologyLocks: draft.terminologyLocks,
    discipline: data.preferences.discipline,
    academicStage: data.preferences.academicStage,
    englishVariant: data.preferences.englishVariant,
    explanationLevel: data.preferences.explanationLevel,
  };
}

export function markReviewAnalysisStarted(data: PersistedWorkspace): PersistedWorkspace {
  return {
    ...data,
    current: {
      ...data.current,
      status: 'analyzing',
      lastError: undefined,
    },
    updatedAt: new Date().toISOString(),
  };
}

export function completeReviewAnalysis(data: PersistedWorkspace, result: ReviewResult): PersistedWorkspace {
  const workspace = data.current;
  if (result.taskId !== workspace.draft.id) {
    throw new Error('分析结果与当前任务不匹配，已拒绝加载。');
  }

  const decisions = Object.fromEntries(result.issues.map((issue) => [issue.id, 'pending' as const]));
  const completed: WorkspaceState = {
    ...workspace,
    currentResult: result,
    decisions,
    appliedEdits: [],
    undoStack: [],
    redoStack: [],
    workingText: workspace.draft.sourceText,
    status: 'reviewing',
    lastError: undefined,
  };
  const entry = createHistoryEntry(completed);
  return {
    ...data,
    current: completed,
    history: [entry, ...data.history.filter((item) => item.id !== entry.id)].slice(0, MAX_HISTORY_ENTRIES),
    updatedAt: new Date().toISOString(),
  };
}

export function failReviewAnalysis(data: PersistedWorkspace, message: string): PersistedWorkspace {
  return {
    ...data,
    current: {
      ...data.current,
      status: data.current.currentResult ? 'reviewing' : 'draft',
      lastError: message,
    },
    updatedAt: new Date().toISOString(),
  };
}

function classifyAnalysisError(error: unknown, timedOut: boolean): { kind: AnalysisFailureKind; message: string } {
  const aborted = error instanceof Error && error.name === 'AbortError';
  if (aborted) {
    return timedOut
      ? {
          kind: 'timeout',
          message: '分析等待超过 65 秒，已在浏览器端停止等待。原文和设置仍保存在此浏览器中。',
        }
      : {
          kind: 'cancelled',
          message: '分析已取消。原文和设置仍保存在此浏览器中。',
        };
  }
  return {
    kind: 'request',
    message: error instanceof Error ? error.message : '分析失败。',
  };
}

export function createReviewAnalysisRun(
  data: PersistedWorkspace,
  options: ReviewAnalysisOptions = {},
): ReviewAnalysisRun {
  const fetcher = options.fetcher || fetch;
  const timeoutMs = options.timeoutMs ?? CLIENT_ANALYSIS_TIMEOUT_MS;
  const controller = new AbortController();
  const request = buildReviewRequest(data);
  let timedOut = false;

  options.onStage?.('preparing');
  const startedData = markReviewAnalysisStarted(data);
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const promise = (async (): Promise<ReviewAnalysisOutcome> => {
    try {
      options.onStage?.('reviewing');
      const response = await fetcher('/api/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ScholarForge-Session': request.taskId,
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      options.onStage?.('organizing');
      let rawPayload: unknown;
      try {
        rawPayload = await response.json();
      } catch {
        throw new Error('分析服务返回了无法解析的响应，请稍后重试。');
      }

      const payload = parseReviewPayload(rawPayload);
      if (!response.ok) {
        const apiPayload = rawPayload as Partial<ApiErrorPayload>;
        throw new Error(payload.error || apiPayload.error || `分析请求失败（HTTP ${response.status}）。`);
      }
      if (!payload.result) throw new Error(payload.error || '分析没有返回有效结果。');

      return {
        ok: true,
        data: completeReviewAnalysis(data, payload.result),
        result: payload.result,
      };
    } catch (error) {
      const failure = classifyAnalysisError(error, timedOut);
      return {
        ok: false,
        data: failReviewAnalysis(data, failure.message),
        ...failure,
      };
    } finally {
      clearTimeout(timeout);
    }
  })();

  return {
    startedData,
    cancel: () => controller.abort(),
    promise,
  };
}
