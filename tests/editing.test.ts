import { describe, expect, it } from 'vitest';
import { analyzeIssueAnchor, applyIssueToWorkspace, redoWorkspace, removeAppliedIssueFromWorkspace, undoWorkspace } from '@/lib/editing/apply';
import type { ReviewIssue, ReviewResult, SafetyGateReport } from '@/lib/types';
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

const passedSafetyGate: SafetyGateReport = {
  status: 'passed',
  checks: [],
  blockedCount: 0,
  reviewCount: 0,
  checkedAt: new Date().toISOString(),
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

  it('blocks every automatic application when the safety gate quarantines the candidate', () => {
    const draft = createDraft({ sourceText: 'The results can well prove this.' });
    const result: ReviewResult = {
      id: 'result-quarantined',
      taskId: draft.id,
      summary: 'Candidate quarantined',
      suggestedText: 'The results indicate this.',
      issues: [issue],
      warnings: [],
      safetyGate: {
        ...passedSafetyGate,
        status: 'quarantined',
        blockedCount: 1,
      },
      generatedAt: new Date().toISOString(),
    };
    const state = { ...createWorkspaceState(draft), currentResult: result };

    expect(() => applyIssueToWorkspace(state, issue)).toThrow('AI 候选稿已被安全门隔离，不能应用到作者工作稿。');
    expect(state.workingText).toBe(draft.sourceText);
    expect(state.appliedEdits).toHaveLength(0);
  });

  it('requires legacy results without a safety report to be analyzed again', () => {
    const draft = createDraft({ sourceText: 'The results can well prove this.' });
    const legacyResult: ReviewResult = {
      id: 'result-legacy',
      taskId: draft.id,
      summary: 'Legacy result',
      suggestedText: 'The results indicate this.',
      issues: [issue],
      warnings: [],
      generatedAt: new Date().toISOString(),
    };
    const state = { ...createWorkspaceState(draft), currentResult: legacyResult };

    expect(() => applyIssueToWorkspace(state, issue)).toThrow('旧版分析结果缺少安全门报告，请重新分析后再应用。');
    expect(state.workingText).toBe(draft.sourceText);
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
      safetyGate: passedSafetyGate,
      generatedAt: new Date().toISOString(),
    };
    const state = { ...createWorkspaceState(draft), currentResult: result };
    const twiceApplied = applyIssueToWorkspace(applyIssueToWorkspace(state, issue), second);
    const removed = removeAppliedIssueFromWorkspace(twiceApplied, issue.id);
    expect(removed.workingText).toBe('The results can well prove the manuscript.');
    expect(removed.appliedEdits.map((edit) => edit.issueId)).toEqual(['issue-2']);
  });
});
