export type AgentId = 'terminology' | 'language' | 'logic' | 'method';

export type IssueSeverity = 'major' | 'minor' | 'suggestion';
export type AgentRunStatus = 'completed' | 'failed' | 'demo';

export type WorkspaceTask = 'translate' | 'polish' | 'precheck';

export type ReviewSection =
  | 'general'
  | 'abstract'
  | 'introduction'
  | 'methods'
  | 'results'
  | 'discussion'
  | 'conclusion';

export type IssueDecision = 'pending' | 'accepted' | 'deferred' | 'dismissed';
export type ReviewOutputKind = 'translation' | 'revision' | 'precheck';

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
  targetJournal: string;
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

export interface AgentRun {
  agent: AgentId;
  status: AgentRunStatus;
  durationMs: number;
  issueCount: number;
  summary: string;
  model: string;
  error?: string;
}

export interface ReviewResult {
  mode: 'live' | 'demo';
  executionMode: 'parallel-multi-agent' | 'safe-demo';
  workflowVersion: string;
  outputKind: ReviewOutputKind;
  profile: ReviewProfile;
  summary: string;
  revisedText: string;
  issues: ReviewIssue[];
  generatedAt: string;
}

export interface ReviewRequest {
  text: string;
  projectTitle?: string;
  taskType?: WorkspaceTask;
  targetJournal?: string;
  sectionType?: ReviewSection;
  lockedTerms?: TerminologyLock[];
}
