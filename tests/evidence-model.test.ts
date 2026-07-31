import { describe, expect, it } from 'vitest';
import { createEvidenceItems, evidenceRisk, requiresIndividualDecision } from '@/lib/evidence-model';
import type { ReviewIssue, ReviewResult } from '@/lib/types';

const languageIssue: ReviewIssue = {
  id: 'language-1',
  agent: 'language',
  severity: 'minor',
  location: 'Methods paragraph 1',
  original: 'The tests was conducted.',
  revised: 'The tests were conducted.',
  reason: 'Subject–verb agreement.',
  category: 'Grammar',
  meaningChanged: false,
};

describe('evidence decision model', () => {
  it('keeps serialized decisions while exposing author-facing labels', () => {
    const result = { issues: [languageIssue] } as ReviewResult;
    const [item] = createEvidenceItems(result, { 'language-1': 'dismissed' }, []);
    expect(item.decision).toBe('dismissed');
    expect(item.decisionLabel).toBe('拒绝');
  });

  it('requires individual confirmation for scientific-risk issues', () => {
    expect(requiresIndividualDecision({ ...languageIssue, severity: 'major' })).toBe(true);
    expect(requiresIndividualDecision({ ...languageIssue, agent: 'method' })).toBe(true);
    expect(requiresIndividualDecision({ ...languageIssue, category: 'Numerical value' })).toBe(true);
    expect(requiresIndividualDecision({ ...languageIssue, meaningChanged: true })).toBe(true);
  });

  it('keeps even low-risk suggestions in the explicit author decision flow', () => {
    expect(evidenceRisk({ ...languageIssue, severity: 'suggestion' })).toBe('low');
    const result = { issues: [{ ...languageIssue, severity: 'suggestion' }] } as ReviewResult;
    const [item] = createEvidenceItems(result, {}, []);
    expect(item.decision).toBe('pending');
    expect(item.applied).toBe(false);
  });
});
