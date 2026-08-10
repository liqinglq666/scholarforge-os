import { describe, expect, it } from 'vitest';
import { reviewReportMarkdown } from '@/lib/exports/files';
import type { ReviewResult, SafetyGateReport } from '@/lib/types';
import { createDraft, createWorkspaceState } from '@/lib/workspace/schema';

function createResult(safetyGate?: SafetyGateReport): ReviewResult {
  return {
    id: 'result-report',
    taskId: 'draft-report',
    summary: 'The manuscript needs one conservative wording review.',
    suggestedText: 'The measured value remained 42.5 MPa.',
    issues: [{
      id: 'issue-report',
      category: 'Language',
      severity: 'minor',
      location: 'Results sentence 1',
      original: 'The value was 42.5 MPa.',
      revised: 'The measured value was 42.5 MPa.',
      reason: 'Use more precise wording without changing the number.',
      meaningChanged: false,
      authorActionRequired: false,
      safeToApply: true,
    }],
    warnings: ['Please verify the cited method against the source paper.'],
    ...(safetyGate ? { safetyGate } : {}),
    generatedAt: '2026-08-10T08:00:00.000Z',
  };
}

function createReportWorkspace(safetyGate?: SafetyGateReport) {
  const draft = createDraft({
    id: 'draft-report',
    projectName: 'Safety Gate report test',
    taskType: 'polish',
    sectionType: 'results',
    sourceText: 'The value was 42.5 MPa.',
  });
  return {
    ...createWorkspaceState(draft),
    currentResult: createResult(safetyGate),
    decisions: { 'issue-report': 'accepted' as const },
    status: 'reviewing' as const,
  };
}

describe('review report Safety Gate export', () => {
  it('includes a passed Safety Gate summary, check evidence, warnings, and author decisions', () => {
    const workspace = createReportWorkspace({
      status: 'passed',
      blockedCount: 0,
      reviewCount: 1,
      checkedAt: '2026-08-10T08:00:01.000Z',
      checks: [{
        id: 'numbers',
        title: '数值一致性',
        state: 'review',
        summary: '数值保持一致，但仍需作者确认统计口径。',
        evidence: ['42.5 MPa 在原文与候选中均保留。'],
      }],
    });

    const report = reviewReportMarkdown(workspace);

    expect(report).toContain('## Safety Gate');
    expect(report).toContain('PASSED（通过当前代码检查）');
    expect(report).toContain('阻断项：0');
    expect(report).toContain('需人工复核：1');
    expect(report).toContain('数值一致性 · REVIEW');
    expect(report).toContain('42.5 MPa 在原文与候选中均保留。');
    expect(report).toContain('## 分析警告');
    expect(report).toContain('Please verify the cited method against the source paper.');
    expect(report).toContain('作者决定：接受');
    expect(report).toContain('PASSED 只表示未被当前代码规则阻断，不代表科学正确');
  });

  it('marks a quarantined candidate and states that automatic application is disabled', () => {
    const workspace = createReportWorkspace({
      status: 'quarantined',
      blockedCount: 1,
      reviewCount: 0,
      checkedAt: '2026-08-10T08:00:01.000Z',
      checks: [{
        id: 'fabrication',
        title: '事实新增检查',
        state: 'blocked',
        summary: '候选包含原文没有提供的事实。',
        evidence: ['候选新增了未提供的实验结论。'],
      }],
    });

    const report = reviewReportMarkdown(workspace);

    expect(report).toContain('QUARANTINED（AI 候选稿已隔离）');
    expect(report).toContain('阻断项：1');
    expect(report).toContain('自动应用权限：已关闭');
    expect(report).toContain('事实新增检查 · BLOCKED');
    expect(report).toContain('候选新增了未提供的实验结论。');
  });

  it('marks legacy results without a Safety Gate report as unverified', () => {
    const workspace = createReportWorkspace();

    const report = reviewReportMarkdown(workspace);

    expect(report).toContain('UNVERIFIED（旧版结果缺少 Safety Gate 报告）');
    expect(report).toContain('自动应用权限已关闭');
    expect(report).toContain('旧版结果没有可导出的 Safety Gate 检查项');
  });
});
