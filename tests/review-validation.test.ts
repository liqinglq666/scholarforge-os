import { describe, expect, it } from 'vitest';
import type { ReviewRequest } from '@/lib/types';
import {
  normalizeModelResult,
  parseReviewRequest,
  runDeterministicChecks,
  ValidationError,
} from '@/lib/review/validation';

const request: ReviewRequest = {
  taskId: 'task-1',
  projectName: 'Concrete paper',
  taskType: 'polish',
  sectionType: 'results',
  targetJournal: '',
  text: 'The strength was 42.5 MPa after 28 d, representing an increase of 12%.',
  terminologyLocks: [],
  discipline: 'Materials Science',
  academicStage: 'doctoral',
  englishVariant: 'us',
  explanationLevel: 'balanced',
};

describe('review request validation', () => {
  it('rejects non-object JSON', () => {
    expect(() => parseReviewRequest([])).toThrowError(ValidationError);
  });

  it('rejects unsupported tasks and short input', () => {
    expect(() => parseReviewRequest({ taskType: 'review-response', sectionType: 'general', text: 'x'.repeat(50) })).toThrow('任务类型');
    expect(() => parseReviewRequest({ taskType: 'polish', sectionType: 'general', text: 'short' })).toThrow('至少需要');
  });

  it('sanitizes settings, preferences, and terminology locks', () => {
    const parsed = parseReviewRequest({
      taskType: 'translate',
      sectionType: 'abstract',
      projectName: ' Test\nProject ',
      text: '这是一段用于测试请求验证和术语锁行为的科研文本，长度应当超过四十个字符，并保持内容完整。',
      terminologyLocks: [{ source: '低场核磁共振', preferred: 'low-field nuclear magnetic resonance' }],
      discipline: ' Environmental Engineering ',
      academicStage: 'doctoral',
      englishVariant: 'uk',
      explanationLevel: 'detailed',
    });
    expect(parsed.projectName).toBe('Test Project');
    expect(parsed.terminologyLocks).toHaveLength(1);
    expect(parsed.discipline).toBe('Environmental Engineering');
    expect(parsed.englishVariant).toBe('uk');
  });
});

describe('deterministic model checks', () => {
  it('passes unchanged values and units', () => {
    const result = runDeterministicChecks(request, 'After 28 d, the strength was 42.5 MPa, which represented a 12% increase.');
    expect(result).toEqual({ passed: true, violations: [] });
  });

  it('blocks changed numbers, units and invented DOI values', () => {
    const result = runDeterministicChecks(request, 'After 28 h, the strength was 45 MPa (15%; doi:10.1000/fake).');
    expect(result.passed).toBe(false);
    expect(result.violations.join(' ')).toMatch(/数值/);
    expect(result.violations.join(' ')).toMatch(/单位/);
    expect(result.violations.join(' ')).toMatch(/DOI/);
  });

  it('blocks a missing terminology lock', () => {
    const locked = { ...request, text: `${request.text} LF-NMR was used.`, terminologyLocks: [{ id: '1', source: 'LF-NMR', preferred: 'low-field nuclear magnetic resonance (LF-NMR)' }] };
    expect(runDeterministicChecks(locked, `${request.text} NMR was used.`).violations[0]).toMatch(/术语锁/);
  });

  it('normalizes issues and disables unsafe application deterministically', () => {
    const result = normalizeModelResult({
      summary: 'One issue.',
      suggestedText: 'After 28 d, the strength was 42.5 MPa, which represented a 12% increase.',
      issues: [{
        id: 'issue-1',
        category: 'Evidence boundary',
        severity: 'major',
        location: 'Sentence 1',
        original: request.text,
        revised: 'After 28 d, the strength was 42.5 MPa, which represented a 12% increase.',
        reason: 'More conservative wording.',
        meaningChanged: true,
        authorActionRequired: false,
        safeToApply: true,
      }],
    }, request);
    expect(result.issues[0].safeToApply).toBe(false);
    expect(result.issues[0].safetyReason).toMatch(/科学含义/);
  });

  it('never marks a local value or citation change as safe to apply', () => {
    const localRequest = { ...request, text: `${request.text} Smith et al. (2020) reported this trend.` };
    const result = normalizeModelResult({
      summary: 'Local safety issue.',
      suggestedText: localRequest.text,
      issues: [{
        id: 'unsafe-local',
        category: 'Language',
        severity: 'minor',
        location: 'Sentence 1',
        original: '42.5 MPa after 28 d',
        revised: '45 MPa after 28 h',
        reason: 'Unsafe change.',
        meaningChanged: false,
        authorActionRequired: false,
        safeToApply: true,
      }],
    }, localRequest);
    expect(result.issues[0].safeToApply).toBe(false);
    expect(result.issues[0].safetyReason).toMatch(/数值/);
  });

  it('blocks claims of newly performed experiments', () => {
    const output = `${request.text} We additionally conducted a new experiment.`;
    expect(runDeterministicChecks(request, output).violations.join(' ')).toMatch(/新增实验/);
  });

  it('rejects duplicate issue IDs', () => {
    const output = {
      summary: 'Two issues.',
      suggestedText: request.text,
      issues: [1, 2].map(() => ({ id: 'duplicate', original: 'strength', revised: 'compressive strength', reason: 'Precision', safeToApply: true })),
    };
    expect(() => normalizeModelResult(output, request)).toThrow(/重复/);
  });
});
