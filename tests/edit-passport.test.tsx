import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReviewWorkbench } from '@/components/review/review-workbench';
import type { WorkspaceState } from '@/lib/types';

const timestamp = '2026-08-08T00:00:00.000Z';

function createWorkspace(status: 'passed' | 'quarantined'): WorkspaceState {
  const sourceText = 'The results show a modest improvement in recovery.';
  const issueId = 'issue-12345';
  return {
    version: 2,
    draft: {
      id: 'task-1',
      projectName: 'Synthetic review',
      taskType: 'polish',
      sectionType: 'results',
      targetJournal: '',
      sourceText,
      terminologyLocks: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    currentResult: {
      id: 'result-1',
      taskId: 'task-1',
      summary: 'One language suggestion.',
      suggestedText: 'The results indicate a modest improvement in recovery.',
      issues: [{
        id: issueId,
        category: '语言清晰度',
        severity: 'suggestion',
        location: 'Results · sentence 1',
        original: 'The results show',
        revised: 'The results indicate',
        reason: 'Use a more precise reporting verb.',
        meaningChanged: false,
        authorActionRequired: false,
        safeToApply: true,
        safetyReason: 'Protected facts are unchanged.',
      }],
      warnings: [],
      safetyGate: {
        status,
        checks: [],
        blockedCount: status === 'quarantined' ? 1 : 0,
        reviewCount: 0,
        checkedAt: timestamp,
      },
      generatedAt: timestamp,
    },
    decisions: { [issueId]: 'pending' },
    appliedEdits: [],
    undoStack: [],
    redoStack: [],
    workingText: sourceText,
    status: 'reviewing',
  };
}

describe('Verified Edit Passport in the real workbench', () => {
  it('shows a passed gate separately from author authorization', () => {
    render(<ReviewWorkbench onStartNew={vi.fn()} onUpdate={vi.fn()} workspace={createWorkspace('passed')} />);

    expect(screen.getByText('科研修改通行证')).toBeInTheDocument();
    expect(screen.getByText('VEP-ISSUE123')).toBeInTheDocument();
    expect(screen.getAllByText('PASSED').length).toBeGreaterThan(0);
    expect(screen.getByText('具备局部定位条件，仍需作者接受')).toBeInTheDocument();
    expect(screen.getByText('最终控制者')).toBeInTheDocument();
  });

  it('removes automatic application permission when the full candidate is quarantined', () => {
    render(<ReviewWorkbench onStartNew={vi.fn()} onUpdate={vi.fn()} workspace={createWorkspace('quarantined')} />);

    expect(screen.getAllByText('BLOCKED').length).toBeGreaterThan(0);
    expect(screen.getByText('quarantined')).toBeInTheDocument();
    expect(screen.getAllByText('禁止自动应用').length).toBeGreaterThan(0);
  });
});
