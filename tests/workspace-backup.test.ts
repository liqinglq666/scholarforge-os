import { describe, expect, it } from 'vitest';
import type { ReviewIssue, ReviewResult } from '@/lib/types';
import { createBackup, createDraft, createPersistedWorkspace, createWorkspaceState, parseBackupText } from '@/lib/workspace/schema';

const issue: ReviewIssue = {
  id: 'issue-1',
  category: 'Language',
  severity: 'minor',
  location: 'Sentence 1',
  original: 'bad phrase',
  revised: 'clear phrase',
  reason: 'Clarity',
  meaningChanged: false,
  authorActionRequired: false,
  safeToApply: true,
};

describe('workspace backup validation', () => {
  it('rejects unknown formats', () => {
    expect(() => parseBackupText(JSON.stringify({ format: 'other', version: 4 }))).toThrow(/受支持/);
  });

  it('rebuilds applied edits from current issues and ignores tampered offsets/text', () => {
    const draft = createDraft({ projectName: 'Test', sourceText: 'A bad phrase appears here.' });
    const result: ReviewResult = { id: 'result-1', taskId: draft.id, summary: 'Done', suggestedText: 'A clear phrase appears here.', issues: [issue], warnings: [], generatedAt: new Date().toISOString() };
    const state = {
      ...createWorkspaceState(draft),
      currentResult: result,
      decisions: { 'issue-1': 'accepted' as const },
      appliedEdits: [{ id: 'tampered', issueId: 'issue-1', start: 9999, end: 10000, original: 'x', revised: 'HACK', appliedAt: new Date().toISOString() }],
      workingText: 'HACK',
      status: 'reviewing' as const,
    };
    const backup = createBackup({ ...createPersistedWorkspace(), current: state });
    const parsed = parseBackupText(JSON.stringify(backup));
    expect(parsed.current.workingText).toBe('A clear phrase appears here.');
    expect(parsed.current.workingText).not.toContain('HACK');
    expect(parsed.current.appliedEdits[0].start).toBe(2);
  });

  it('drops an edit whose current issue is no longer uniquely anchored', () => {
    const draft = createDraft({ sourceText: 'bad phrase and bad phrase' });
    const result: ReviewResult = { id: 'r', taskId: draft.id, summary: '', suggestedText: draft.sourceText, issues: [issue], warnings: [], generatedAt: new Date().toISOString() };
    const state = { ...createWorkspaceState(draft), currentResult: result, appliedEdits: [{ id: 'x', issueId: issue.id, start: 0, end: 10, original: issue.original, revised: issue.revised, appliedAt: new Date().toISOString() }], status: 'reviewing' as const };
    const parsed = parseBackupText(JSON.stringify(createBackup({ ...createPersistedWorkspace(), current: state })));
    expect(parsed.current.appliedEdits).toHaveLength(0);
    expect(parsed.current.workingText).toBe(draft.sourceText);
  });
});
