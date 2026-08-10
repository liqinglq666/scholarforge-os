import { describe, expect, it } from 'vitest';
import {
  applyIssueToWorkspace,
  issueDecisionRequiresAppliedEditRemoval,
  setIssueDecisionInWorkspace,
  undoWorkspace,
} from '@/lib/editing/apply';
import type { ReviewIssue, ReviewResult } from '@/lib/types';
import { createDraft, createWorkspaceState } from '@/lib/workspace/schema';

function issue(id: string, original: string, revised: string): ReviewIssue {
  return {
    id,
    category: 'Language',
    severity: 'minor',
    location: id,
    original,
    revised,
    reason: 'Conservative wording change.',
    meaningChanged: false,
    authorActionRequired: false,
    safeToApply: true,
  };
}

function workspaceWithIssues() {
  const first = issue('issue-1', 'The sample was stable.', 'The sample remained stable.');
  const second = issue('issue-2', 'The value was 42.5 MPa.', 'The measured value was 42.5 MPa.');
  const sourceText = `${first.original} ${second.original}`;
  const draft = createDraft({ sourceText });
  const result: ReviewResult = {
    id: 'result-1',
    taskId: draft.id,
    summary: 'Two suggestions.',
    suggestedText: `${first.revised} ${second.revised}`,
    issues: [first, second],
    warnings: [],
    safetyGate: {
      status: 'passed',
      checks: [],
      blockedCount: 0,
      reviewCount: 0,
      checkedAt: new Date().toISOString(),
    },
    generatedAt: new Date().toISOString(),
  };
  return {
    first,
    second,
    workspace: {
      ...createWorkspaceState(draft),
      currentResult: result,
      decisions: { 'issue-1': 'pending' as const, 'issue-2': 'pending' as const },
      status: 'reviewing' as const,
    },
  };
}

describe('author decision transitions', () => {
  it('does not require edit removal when the issue is not applied', () => {
    const { workspace, first } = workspaceWithIssues();

    expect(issueDecisionRequiresAppliedEditRemoval(workspace, first.id, 'rejected')).toBe(false);
    const next = setIssueDecisionInWorkspace(workspace, first.id, 'rejected');

    expect(next.decisions[first.id]).toBe('rejected');
    expect(next.workingText).toBe(workspace.workingText);
    expect(next.appliedEdits).toEqual([]);
  });

  it('requires removal when an applied issue changes away from accepted', () => {
    const { workspace, first } = workspaceWithIssues();
    const applied = applyIssueToWorkspace(workspace, first);

    expect(applied.decisions[first.id]).toBe('accepted');
    expect(issueDecisionRequiresAppliedEditRemoval(applied, first.id, 'rejected')).toBe(true);
    expect(issueDecisionRequiresAppliedEditRemoval(applied, first.id, 'deferred')).toBe(true);
    expect(issueDecisionRequiresAppliedEditRemoval(applied, first.id, 'accepted')).toBe(false);
  });

  it('removes only the affected applied edit and records the new decision', () => {
    const { workspace, first, second } = workspaceWithIssues();
    const bothApplied = applyIssueToWorkspace(applyIssueToWorkspace(workspace, first), second);

    const next = setIssueDecisionInWorkspace(bothApplied, first.id, 'rejected');

    expect(next.decisions[first.id]).toBe('rejected');
    expect(next.decisions[second.id]).toBe('accepted');
    expect(next.appliedEdits.map((edit) => edit.issueId)).toEqual([second.id]);
    expect(next.workingText).toContain(first.original);
    expect(next.workingText).not.toContain(first.revised);
    expect(next.workingText).toContain(second.revised);
    expect(next.undoStack.length).toBeGreaterThan(bothApplied.undoStack.length);
  });

  it('keeps the applied text when the author decision remains accepted', () => {
    const { workspace, first } = workspaceWithIssues();
    const applied = applyIssueToWorkspace(workspace, first);

    const next = setIssueDecisionInWorkspace(applied, first.id, 'accepted');

    expect(next).toBe(applied);
    expect(next.appliedEdits).toHaveLength(1);
    expect(next.workingText).toContain(first.revised);
  });

  it('allows undo to restore the working-text edit after a decision-triggered removal', () => {
    const { workspace, first } = workspaceWithIssues();
    const applied = applyIssueToWorkspace(workspace, first);
    const rejected = setIssueDecisionInWorkspace(applied, first.id, 'rejected');

    const undone = undoWorkspace(rejected);

    expect(undone.workingText).toBe(applied.workingText);
    expect(undone.appliedEdits.map((edit) => edit.issueId)).toEqual([first.id]);
    expect(undone.decisions[first.id]).toBe('rejected');
  });
});
