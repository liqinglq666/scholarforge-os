import { describe, expect, it } from 'vitest';
import { analyzeIssueAnchor, applyIssueToWorkspace, redoWorkspace, removeAppliedIssueFromWorkspace, undoWorkspace } from '@/lib/editing/apply';
import type { ReviewIssue, ReviewResult } from '@/lib/types';
import { createDraft, createWorkspaceState } from '@/lib/workspace/schema';

const issue: ReviewIssue = {
  id: 'issue-1',
  category: 'Language',
  severity: 'minor',
  location: 'Sentence 1',
  original: 'can well prove',
  revised: 'indicate',
  reason: 'Avoid overstatement.',
  meaningChanged: false,
  authorActionRequired: false,
  safeToApply: true,
};

describe('safe issue application', () => {
  it('requires a unique current anchor', () => {
    expect(analyzeIssueAnchor('The results can well prove this.', issue, []).state).toBe('safe-exact');
    expect(analyzeIssueAnchor('can well prove and can well prove', issue, []).state).toBe('ambiguous');
    expect(analyzeIssueAnchor('The text changed.', issue, []).state).toBe('missing');
  });

  it('blocks meaning changes and placeholders', () => {
    expect(analyzeIssueAnchor('The results can well prove this.', { ...issue, meaningChanged: true }, []).state).toBe('manual');
    expect(analyzeIssueAnchor('The results can well prove this.', { ...issue, revised: '[Please provide data]' }, []).state).toBe('manual');
  });

  it('applies one issue and supports undo and redo', () => {
    const state = createWorkspaceState(createDraft({ sourceText: 'The results can well prove this.' }));
    const applied = applyIssueToWorkspace(state, issue);
    expect(applied.workingText).toBe('The results indicate this.');
    expect(applied.appliedEdits).toHaveLength(1);
    expect(undoWorkspace(applied).workingText).toBe(state.workingText);
    expect(redoWorkspace(undoWorkspace(applied)).workingText).toBe(applied.workingText);
  });

  it('removes one applied issue and safely replays retained edits', () => {
    const second: ReviewIssue = {
      ...issue,
      id: 'issue-2',
      original: 'this manuscript',
      revised: 'the manuscript',
    };
    const draft = createDraft({ sourceText: 'The results can well prove this manuscript.' });
    const result: ReviewResult = {
      id: 'result-1',
      taskId: draft.id,
      summary: 'Done',
      suggestedText: 'The results indicate the manuscript.',
      issues: [issue, second],
      warnings: [],
      generatedAt: new Date().toISOString(),
    };
    const state = { ...createWorkspaceState(draft), currentResult: result };
    const twiceApplied = applyIssueToWorkspace(applyIssueToWorkspace(state, issue), second);
    const removed = removeAppliedIssueFromWorkspace(twiceApplied, issue.id);
    expect(removed.workingText).toBe('The results can well prove the manuscript.');
    expect(removed.appliedEdits.map((edit) => edit.issueId)).toEqual(['issue-2']);
  });
});
