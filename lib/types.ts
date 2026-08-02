export type TaskType = 'translate' | 'polish' | 'precheck';

export type SectionType =
  | 'general'
  | 'abstract'
  | 'introduction'
  | 'methods'
  | 'results'
  | 'discussion'
  | 'conclusion';

export type IssueSeverity = 'major' | 'minor' | 'suggestion';
export type IssueDecision = 'pending' | 'accepted' | 'rejected' | 'deferred';
export type WorkspaceStatus = 'draft' | 'analyzing' | 'reviewing' | 'error';

export interface TerminologyLock {
  id: string;
  source: string;
  preferred: string;
  note?: string;
}

export interface ImportedDocument {
  fileName: string;
  importedAt: string;
  warnings: string[];
}

export interface WorkspaceDraft {
  id: string;
  projectName: string;
  taskType: TaskType;
  sectionType: SectionType;
  targetJournal: string;
  sourceText: string;
  terminologyLocks: TerminologyLock[];
  importedDocument?: ImportedDocument;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewIssue {
  id: string;
  category: string;
  severity: IssueSeverity;
  location: string;
  original: string;
  revised: string;
  reason: string;
  meaningChanged: boolean;
  authorActionRequired: boolean;
  safeToApply: boolean;
  safetyReason?: string;
}

export interface ReviewResult {
  id: string;
  taskId: string;
  summary: string;
  suggestedText: string;
  issues: ReviewIssue[];
  warnings: string[];
  generatedAt: string;
}

export interface AppliedEdit {
  id: string;
  issueId: string;
  start: number;
  end: number;
  original: string;
  revised: string;
  appliedAt: string;
}

export interface UndoFrame {
  workingText: string;
  appliedEdits: AppliedEdit[];
}

export interface WorkspaceState {
  version: 2;
  draft: WorkspaceDraft;
  currentResult: ReviewResult | null;
  decisions: Record<string, IssueDecision>;
  appliedEdits: AppliedEdit[];
  undoStack: UndoFrame[];
  redoStack: UndoFrame[];
  workingText: string;
  status: WorkspaceStatus;
  lastError?: string;
  savedAt?: string;
}

export interface HistoryEntry {
  id: string;
  projectName: string;
  taskType: TaskType;
  sectionType: SectionType;
  sourceCharacterCount: number;
  issueCount: number;
  resolvedIssueCount: number;
  savedAt: string;
  workspace: WorkspaceState;
}

export interface PersistedWorkspace {
  version: 2;
  current: WorkspaceState;
  history: HistoryEntry[];
  updatedAt: string;
}

export interface WorkspaceBackup {
  format: 'scholarforge-workspace';
  version: 2;
  exportedAt: string;
  current: WorkspaceState;
  history: HistoryEntry[];
}

export interface ReviewRequest {
  taskId: string;
  projectName: string;
  taskType: TaskType;
  sectionType: SectionType;
  targetJournal: string;
  text: string;
  terminologyLocks: TerminologyLock[];
}

export interface ReviewServiceStatus {
  configured: boolean;
  model: string | null;
  message: string;
  limits: {
    maxCharacters: number;
    maxRequestBytes: number;
    requestsPerWindow: number;
    windowMinutes: number;
  };
}

export interface ApiErrorPayload {
  error: string;
  code: string;
  requestId: string;
  detail?: string;
  retryAfter?: number;
}
