import { describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '@/lib/app-config';
import { parseWorkspaceBackup, readWorkspaceState } from '@/lib/workspace-store';

function memoryStorage(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    id: 'snapshot-1',
    projectTitle: 'ECC paper',
    taskType: 'precheck',
    sourceText: 'A valid manuscript paragraph with enough source text for review.',
    targetJournal: '',
    sectionType: 'methods',
    lockedTerms: [],
    requestId: 'request-1',
    result: {
      outputKind: 'precheck',
      profile: {
        projectTitle: 'ECC paper',
        taskType: 'precheck',
        sectionType: 'methods',
        targetJournal: '',
        lockedTerms: [],
      },
      summary: 'Review complete.',
      revisedText: 'A valid manuscript paragraph with enough source text for review.',
      issues: [],
      generatedAt: '2026-07-31T00:00:00.000Z',
    },
    decisions: {},
    appliedEdits: [],
    savedAt: '2026-07-31T00:00:00.000Z',
    ...overrides,
  };
}

describe('workspace store', () => {
  it('keeps valid legacy draft data readable', () => {
    const draft = { projectTitle: 'ECC paper', taskType: 'precheck', sourceText: 'A valid manuscript paragraph.', savedAt: '2026-07-31T00:00:00.000Z' };
    const state = readWorkspaceState(memoryStorage({ [STORAGE_KEYS.draft]: JSON.stringify(draft), [STORAGE_KEYS.history]: '[]' }));
    expect(state.draft?.projectTitle).toBe('ECC paper');
  });

  it('does not delete malformed browser data while returning a recoverable warning', () => {
    const storage = memoryStorage({ [STORAGE_KEYS.history]: '{broken-json' });
    const state = readWorkspaceState(storage);
    expect(state.history).toEqual([]);
    expect(state.warnings).toContain('任务历史无法解析，原始浏览器数据已保留。');
    expect(storage.getItem(STORAGE_KEYS.history)).toBe('{broken-json');
  });

  it('converts removed reviewer-response drafts without deleting the source text', () => {
    const storage = memoryStorage({
      [STORAGE_KEYS.draft]: JSON.stringify({
        projectTitle: 'Reviewer reply',
        taskType: 'review-response',
        sourceText: 'The reviewer requested additional evidence and clarification.',
        savedAt: '2026-07-31T00:00:00.000Z',
      }),
      [STORAGE_KEYS.history]: '[]',
    });
    const state = readWorkspaceState(storage);
    expect(state.draft?.taskType).toBe('precheck');
    expect(state.draft?.sourceText).toContain('reviewer requested');
    expect(state.warnings).toContain('旧版审稿回复草稿已转换为投稿前预检，原文仍保留。');
  });

  it('hides legacy demo results without deleting raw browser data', () => {
    const legacyDemo = snapshot({
      result: {
        ...snapshot().result as Record<string, unknown>,
        mode: 'demo',
        executionMode: 'safe-demo',
        workflowVersion: '0.9.0-demo',
      },
    });
    const rawHistory = JSON.stringify([legacyDemo]);
    const storage = memoryStorage({ [STORAGE_KEYS.history]: rawHistory });
    const state = readWorkspaceState(storage);

    expect(state.history).toEqual([]);
    expect(state.warnings).toContain('旧版演示分析记录已隐藏，不会修改原始浏览器数据。');
    expect(storage.getItem(STORAGE_KEYS.history)).toBe(rawHistory);
  });

  it('removes retired execution metadata from retained snapshots', () => {
    const legacyLive = snapshot({
      result: {
        ...snapshot().result as Record<string, unknown>,
        mode: 'live',
        executionMode: 'parallel-multi-agent',
        workflowVersion: '0.9.0',
        agentRuns: [{ status: 'completed' }],
        scoreBefore: 70,
        scoreAfter: 88,
      },
    });
    const state = readWorkspaceState(memoryStorage({
      [STORAGE_KEYS.history]: JSON.stringify([legacyLive]),
    }));
    const result = state.history[0]?.result as unknown as Record<string, unknown>;

    expect(state.history).toHaveLength(1);
    expect(result.mode).toBeUndefined();
    expect(result.executionMode).toBeUndefined();
    expect(result.workflowVersion).toBeUndefined();
    expect(result.agentRuns).toBeUndefined();
    expect(result.scoreBefore).toBeUndefined();
  });

  it('rejects unsupported backup envelopes', () => {
    expect(() => parseWorkspaceBackup({ format: 'other', version: 1, history: [] })).toThrow('这不是受支持的 ScholarForge 工作区备份。');
  });

  it('sanitizes invalid decisions and persisted edits before restoring history', () => {
    const sourceText = 'The tests was conducted.';
    const stored = snapshot({
      sourceText,
      result: {
        ...snapshot().result as Record<string, unknown>,
        issues: [{
          id: 'issue-1', agent: 'language', severity: 'minor', location: 'P1', original: sourceText,
          revised: 'The tests were conducted.', reason: 'Grammar', category: 'Grammar', meaningChanged: false,
        }],
      },
      decisions: { 'issue-1': 'not-a-decision', ghost: 'accepted' },
      appliedEdits: [{
        issueId: 'issue-1', start: 0, end: 4, original: 'Wrong', revised: 'The', appliedAt: '2026-07-31T00:00:00.000Z',
      }],
    });
    const state = readWorkspaceState(memoryStorage({ [STORAGE_KEYS.history]: JSON.stringify([stored]) }));
    expect(state.history[0]?.decisions).toEqual({});
    expect(state.history[0]?.appliedEdits).toEqual([]);
  });

  it('normalizes duplicate issue and terminology identifiers', () => {
    const stored = snapshot({
      lockedTerms: [
        { id: 'same', source: 'A', preferred: 'Alpha' },
        { id: 'same', source: 'B', preferred: 'Beta' },
      ],
      result: {
        ...snapshot().result as Record<string, unknown>,
        issues: [
          { id: 'same', agent: 'language', severity: 'minor', location: 'P1', original: 'A', revised: 'B', reason: 'R', category: 'C', meaningChanged: false },
          { id: 'same', agent: 'logic', severity: 'major', location: 'P2', original: 'C', revised: 'D', reason: 'R', category: 'C', meaningChanged: true },
        ],
      },
    });
    const restored = readWorkspaceState(memoryStorage({ [STORAGE_KEYS.history]: JSON.stringify([stored]) })).history[0];
    expect(new Set(restored?.lockedTerms.map((lock) => lock.id)).size).toBe(2);
    expect(new Set(restored?.result.issues.map((item) => item.id)).size).toBe(2);
  });

});
