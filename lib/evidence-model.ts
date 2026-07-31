import { DECISION_LABELS } from '@/lib/app-config';
import type { AppliedEdit } from '@/lib/author-editing';
import type { IssueDecision, ReviewIssue, ReviewResult } from '@/lib/types';

export type EvidenceRisk = 'high' | 'medium' | 'low';

export interface EvidenceItem {
  issue: ReviewIssue;
  decision: IssueDecision;
  decisionLabel: string;
  risk: EvidenceRisk;
  applied: boolean;
  requiresIndividualDecision: boolean;
}

const INDIVIDUAL_PATTERN = /(terminology|term|number|numerical|value|conclusion|citation|reference|equation|unit|术语|数值|结论|引用|参考文献|公式|单位)/i;

export function requiresIndividualDecision(issue: ReviewIssue) {
  return issue.severity === 'major'
    || issue.meaningChanged
    || issue.agent === 'logic'
    || issue.agent === 'method'
    || INDIVIDUAL_PATTERN.test(`${issue.category} ${issue.reason}`);
}

export function evidenceRisk(issue: ReviewIssue): EvidenceRisk {
  if (requiresIndividualDecision(issue)) return 'high';
  if (issue.severity === 'minor') return 'medium';
  return 'low';
}

export function createEvidenceItems(
  result: ReviewResult,
  decisions: Record<string, IssueDecision>,
  applied: AppliedEdit[],
): EvidenceItem[] {
  return result.issues.map((issue) => {
    const decision = decisions[issue.id] || 'pending';
    return {
      issue,
      decision,
      decisionLabel: DECISION_LABELS[decision],
      risk: evidenceRisk(issue),
      applied: applied.some((edit) => edit.issueId === issue.id),
      requiresIndividualDecision: requiresIndividualDecision(issue),
    };
  });
}
