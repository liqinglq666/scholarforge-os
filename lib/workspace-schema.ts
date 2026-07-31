import type { AppliedEdit } from '@/lib/author-editing';
import type {
  IssueDecision,
  ReviewResult,
  ReviewSection,
  TerminologyLock,
  WorkspaceTask,
} from '@/lib/types';

export interface ImportedDocumentMeta {
  fileName: string;
  fileType: 'docx';
  sectionTitle: string;
  sourceLabel: string;
  importedAt: string;
}

export interface WorkspaceDraft {
  projectTitle?: string;
  taskType?: WorkspaceTask;
  sourceText?: string;
  targetJournal?: string;
  sectionType?: ReviewSection;
  lockedTerms?: TerminologyLock[];
  savedAt?: string;
  importedDocument?: ImportedDocumentMeta;
  [key: string]: unknown;
}

export interface ReviewSnapshot {
  id: string;
  projectTitle: string;
  taskType: WorkspaceTask;
  sourceText: string;
  targetJournal: string;
  sectionType: ReviewSection;
  lockedTerms: TerminologyLock[];
  requestId: string;
  result: ReviewResult;
  decisions: Record<string, IssueDecision>;
  appliedEdits?: AppliedEdit[];
  savedAt: string;
  [key: string]: unknown;
}

export interface WorkspaceBackup {
  format: 'scholarforge-workspace-backup';
  version: 1;
  exportedAt: string;
  draft: WorkspaceDraft | null;
  history: ReviewSnapshot[];
}

export interface WorkspaceState {
  draft: WorkspaceDraft | null;
  history: ReviewSnapshot[];
  warnings: string[];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isWorkspaceDraft(value: unknown): value is WorkspaceDraft {
  if (!isRecord(value)) return false;
  return value.projectTitle === undefined || typeof value.projectTitle === 'string';
}

export function isReviewSnapshot(value: unknown): value is ReviewSnapshot {
  if (!isRecord(value) || !isRecord(value.result)) return false;
  return typeof value.id === 'string'
    && typeof value.projectTitle === 'string'
    && typeof value.sourceText === 'string'
    && typeof value.savedAt === 'string'
    && Array.isArray(value.result.issues);
}
