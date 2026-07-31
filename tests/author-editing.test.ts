import { describe, expect, it } from 'vitest';
import { analyseIssueAnchor, composeWorkingText, createAppliedEdit } from '@/lib/author-editing';
import type { ReviewIssue } from '@/lib/types';

const issue: ReviewIssue = {
  id: 'issue-1',
  agent: 'language',
  severity: 'minor',
  location: 'Paragraph 1',
  original: 'The tests was conducted.',
  revised: 'The tests were conducted.',
  reason: 'Grammar',
  category: 'Grammar',
  meaningChanged: false,
};

describe('author editing anchors', () => {
  it('applies a unique exact match', () => {
    const analysis = analyseIssueAnchor(issue.original, issue, []);
    const edit = createAppliedEdit(issue, analysis);
    expect(analysis.state).toBe('safe-exact');
    expect(edit).not.toBeNull();
    expect(composeWorkingText(issue.original, edit ? [edit] : [])).toBe(issue.revised);
  });

  it('rejects ambiguous and author-placeholder edits', () => {
    expect(analyseIssueAnchor(`${issue.original} ${issue.original}`, issue, []).state).toBe('ambiguous');
    expect(analyseIssueAnchor(issue.original, { ...issue, revised: '[Please provide sample count]' }, []).state).toBe('manual');
  });
});
