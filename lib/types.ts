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
export type AcademicStage = 'masters' | 'doctoral' | 'postgraduate' | 'researcher' | 'other';
export type EnglishVariant = 'us' | 'uk';
export type ExplanationLevel = 'brief' | 'balanced' | 'detailed';
export type SafetyCheckState = 'passed' | 'blocked' | 'review';
export type SafetyGateStatus = 'passed' | 'quarantined';

export interface TerminologyLock {
  id: string;
  source: string;
  preferred: string;
  note?: string;
}

export interface ChapterTemplateItem {
  id: string;
  title: string;
  sectionType: SectionType;
}

export interface UserPreferences {
  displayName: string;
  discipline: string;
  academicStage: AcademicStage;
  englishVariant: EnglishVariant;
  explanationLevel: ExplanationLevel;
  defaultTaskType: TaskType;
  defaultSectionType: SectionType;
  defaultTargetJournal: string;
  customWritingRules: TerminologyLock[];
  chapterTemplate: ChapterTemplateItem[];
  updatedAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
}

export interface AuthStatus {
  configured: boolean;
  authenticated: boolean;
  user: AuthUser | null;
  message: string;
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
  linkedProjectId?: string;
  linkedChapterId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ManuscriptChapter {
  id: string;
  title: string;
  sectionType: SectionType;
  text: string;
  createdAt: string;
  updatedAt: string;
  lastReviewedAt?: string;
}

export type SupervisorFeedbackStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'needs_clarification'
  | 'not_adopted';

export type SupervisorFeedbackPriority = 'high' | 'normal' | 'low';

export interface SupervisorFeedbackItem {
  id: string;
  comment: string;
  chapterId?: string;
  location?: string;
  status: SupervisorFeedbackStatus;
  priority: SupervisorFeedbackPriority;
  authorResponse: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export type RevisionChangeKind = 'added' | 'removed' | 'modified';
export type RevisionChangeSource = 'author' | 'ai' | 'supervisor' | 'unknown';

export interface RevisionChange {
  id: string;
  kind: RevisionChangeKind;
  before: string;
  after: string;
  source: RevisionChangeSource;
  reason: string;
  feedbackId?: string;
}

export interface RevisionComparison {
  id: string;
  title: string;
  chapterId?: string;
  baseLabel: string;
  revisedLabel: string;
  baseText: string;
  revisedText: string;
  changes: RevisionChange[];
  createdAt: string;
  updatedAt: string;
}

export interface ManuscriptProject {
  id: string;
  name: string;
  targetJournal: string;
  terminologyLocks: TerminologyLock[];
  chapters: ManuscriptChapter[];
  supervisorFeedback: SupervisorFeedbackItem[];
  revisionComparisons: RevisionComparison[];
  activeChapterId?: string;
  createdAt: string;
  updatedAt: string;
}

export type ConsistencyIssueType = 'sample-size' | 'metric-value' | 'abbreviation' | 'terminology';

export interface ConsistencyOccurrence {
  chapterId: string;
  chapterTitle: string;
  excerpt: string;
}

export interface ConsistencyIssue {
  id: string;
  type: ConsistencyIssueType;
  severity: IssueSeverity;
  title: string;
  description: string;
  occurrences: ConsistencyOccurrence[];
}

export interface SafetyCheck {
  id: string;
  title: string;
  state: SafetyCheckState;
  summary: string;
  evidence: string[];
}

export interface SafetyGateReport {
  status: SafetyGateStatus;
  checks: SafetyCheck[];
  blockedCount: number;
  reviewCount: number;
  checkedAt: string;
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
  safetyGate?: SafetyGateReport;
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
  version: 3;
  current: WorkspaceState;
  history: HistoryEntry[];
  projects: ManuscriptProject[];
  activeProjectId?: string;
  preferences: UserPreferences;
  updatedAt: string;
}

export interface WorkspaceBackup {
  format: 'scholarforge-workspace';
  version: 3;
  exportedAt: string;
  current: WorkspaceState;
  history: HistoryEntry[];
  projects: ManuscriptProject[];
  activeProjectId?: string;
  preferences: UserPreferences;
}

export interface ReviewRequest {
  taskId: string;
  projectName: string;
  taskType: TaskType;
  sectionType: SectionType;
  targetJournal: string;
  text: string;
  terminologyLocks: TerminologyLock[];
  discipline: string;
  academicStage: AcademicStage;
  englishVariant: EnglishVariant;
  explanationLevel: ExplanationLevel;
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
