import { describe, expect, it } from 'vitest';
import { analyseIssueAnchor, composeWorkingText, createAppliedEdit, normalizeAppliedEdits } from '@/lib/author-editing';
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

  it('rejects cross-line and broader author placeholders', () => {
    const crossLine = { ...issue, original: 'The tests was\nconducted.', revised: 'The tests were conducted.' };
    expect(analyseIssueAnchor(crossLine.original, crossLine, []).state).toBe('manual');
    expect(analyseIssueAnchor(issue.original, { ...issue, revised: '[Author to confirm sample count]' }, []).state).toBe('manual');
  });

  it('drops persisted edits with invalid ranges, mismatched anchors, or overlaps', () => {
    const source = 'Alpha beta gamma.';
    const valid = {
      issueId: 'valid', start: 6, end: 10, original: 'beta', revised: 'BETA', appliedAt: '2026-07-31T00:00:00.000Z',
    };
    const invalid = {
      issueId: 'invalid', start: 0, end: 5, original: 'wrong', revised: 'ALPHA', appliedAt: '2026-07-31T00:00:00.000Z',
    };
    const overlap = {
      issueId: 'overlap', start: 7, end: 12, original: 'eta g', revised: 'X', appliedAt: '2026-07-31T00:00:00.000Z',
    };
    const normalized = normalizeAppliedEdits(source, [valid, invalid, overlap]);
    expect(normalized.valid.map((edit) => edit.issueId)).toEqual(['valid']);
    expect(composeWorkingText(source, [valid, invalid, overlap])).toBe('Alpha BETA gamma.');
  });

});
