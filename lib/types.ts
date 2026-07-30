export type AgentId = 'terminology' | 'language' | 'logic' | 'method';

export type IssueSeverity = 'major' | 'minor' | 'suggestion';
export type AgentRunStatus = 'completed' | 'failed' | 'demo';

export type WorkspaceTask = 'translate' | 'polish' | 'precheck' | 'review-response';

export type ReviewSection =
  | 'general'
  | 'abstract'
  | 'introduction'
  | 'methods'
  | 'results'
  | 'discussion'
  | 'conclusion';

export type ReviewMode = 'conservative' | 'balanced' | 'deep';
export type IssueDecision = 'pending' | 'accepted' | 'deferred' | 'dismissed';
export type ReviewOutputKind = 'translation' | 'revision' | 'precheck' | 'reviewer-response';

export interface TerminologyLock {
  id: string;
  source: string;
  preferred: string;
  note?: string;
}

export interface ReviewProfile {
  projectTitle: string;
  taskType: WorkspaceTask;
  sectionType: ReviewSection;
  reviewMode: ReviewMode;
  targetJournal: string;
  responseLocation: string;
  supportingContextProvided: boolean;
  lockedTerms: TerminologyLock[];
}

export interface ReviewIssue {
  id: string;
  agent: AgentId;
  severity: IssueSeverity;
  location: string;
  original: string;
  revised: string;
  reason: string;
  category: string;
  meaningChanged: boolean;
}

export interface TerminologyItem {
  preferred: string;
  avoid: string[];
  note: string;
}

export interface AgentRun {
  agent: AgentId;
  status: AgentRunStatus;
  durationMs: number;
  issueCount: number;
  summary: string;
  model: string;
  error?: string;
}

export interface ReviewGuardrail {
  id: string;
  label: string;
  passed: boolean;
}

export interface ReviewResult {
  mode: 'live' | 'demo';
  executionMode: 'parallel-multi-agent' | 'safe-demo';
  workflowVersion: string;
  outputKind: ReviewOutputKind;
  profile: ReviewProfile;
  summary: string;
  revisedText: string;
  scoreBefore: number;
  scoreAfter: number;
  decision: 'major_revision' | 'minor_revision' | 'ready';
  decisionReason: string;
  issues: ReviewIssue[];
  terminology: TerminologyItem[];
  agentRuns: AgentRun[];
  guardrails: ReviewGuardrail[];
  generatedAt: string;
}

export interface ReviewRequest {
  text: string;
  projectTitle?: string;
  taskType?: WorkspaceTask;
  targetJournal?: string;
  sectionType?: ReviewSection;
  reviewMode?: ReviewMode;
  supportingContext?: string;
  responseLocation?: string;
  lockedTerms?: TerminologyLock[];
}
