export type AgentId = 'terminology' | 'language' | 'logic' | 'method';

export type IssueSeverity = 'major' | 'minor' | 'suggestion';

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

export interface ReviewResult {
  mode: 'live' | 'demo';
  summary: string;
  revisedText: string;
  scoreBefore: number;
  scoreAfter: number;
  decision: 'major_revision' | 'minor_revision' | 'ready';
  issues: ReviewIssue[];
  terminology: TerminologyItem[];
  generatedAt: string;
}

export interface ReviewRequest {
  text: string;
  targetJournal?: string;
}
