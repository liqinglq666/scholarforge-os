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

  it('rejects unsupported backup envelopes', () => {
    expect(() => parseWorkspaceBackup({ format: 'other', version: 1, history: [] })).toThrow('这不是受支持的 ScholarForge 工作区备份。');
  });
});
