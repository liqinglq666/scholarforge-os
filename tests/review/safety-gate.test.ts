import { describe, expect, it } from 'vitest';
import { evaluateLocalRevision, evaluateSafetyGate } from '@/lib/review/safety-gate';
import { normalizeModelResult } from '@/lib/review/validation';
import type { ReviewRequest } from '@/lib/types';

function request(text: string): ReviewRequest {
  return {
    taskId: 'task-safety-gate',
    projectName: 'Safety gate test',
    taskType: 'polish',
    sectionType: 'discussion',
    targetJournal: '',
    text,
    terminologyLocks: [],
    discipline: 'Public health',
    academicStage: 'researcher',
    englishVariant: 'us',
    explanationLevel: 'balanced',
  };
}

describe('scientific safety gate', () => {
  it('passes a candidate that preserves scientific facts and claim boundaries', () => {
    const source = 'In 120 participants, short sleep was associated with anxiety (mean difference, 3.2 points).';
    const report = evaluateSafetyGate(request(source), 'Among 120 participants, short sleep was associated with anxiety (mean difference, 3.2 points).');

    expect(report.status).toBe('passed');
    expect(report.blockedCount).toBe(0);
  });

  it('quarantines changed sample sizes and values', () => {
    const source = 'A total of 120 participants completed the survey, and 62.3% reported fatigue.';
    const report = evaluateSafetyGate(request(source), 'A total of 102 participants completed the survey, and 68.3% reported fatigue.');

    expect(report.status).toBe('quarantined');
    expect(report.checks.find((check) => check.id === 'numbers')?.state).toBe('blocked');
  });

  it('quarantines correlation-to-causation escalation', () => {
    const source = 'Short sleep was associated with anxiety in this cross-sectional sample.';
    const report = evaluateSafetyGate(request(source), 'Short sleep caused anxiety in this cross-sectional sample.');

    expect(report.status).toBe('quarantined');
    expect(report.checks.find((check) => check.id === 'claim-boundary')?.summary).toContain('因果');
  });

  it('quarantines limited-sample claims broadened to everyone', () => {
    const source = 'The sample included participants from three universities in eastern China.';
    const report = evaluateSafetyGate(request(source), 'The findings apply to all university students nationwide.');

    expect(report.status).toBe('quarantined');
    expect(report.checks.find((check) => check.id === 'claim-boundary')?.summary).toContain('普遍结论');
  });

  it('blocks local revisions that change certainty', () => {
    const violations = evaluateLocalRevision(
      'These findings may indicate a relationship.',
      'These findings prove a relationship.',
    );

    expect(violations.join(' ')).toContain('确定性');
  });

  it('does not trust a model-provided safeToApply value', () => {
    const source = 'Short sleep was associated with anxiety in 120 participants.';
    const result = normalizeModelResult({
      summary: 'Review complete.',
      suggestedText: 'Short sleep caused anxiety in 102 participants.',
      issues: [{
        id: 'unsafe-1',
        category: 'Evidence boundary',
        severity: 'major',
        location: 'Sentence 1',
        original: source,
        revised: 'Short sleep caused anxiety in 102 participants.',
        reason: 'Stronger wording.',
        meaningChanged: false,
        authorActionRequired: false,
        safeToApply: true,
      }],
    }, request(source));

    expect(result.safetyGate?.status).toBe('quarantined');
    expect(result.issues[0].safeToApply).toBe(false);
    expect(result.issues[0].safetyReason).toContain('隔离');
  });
});
