import { MAX_HISTORY, STORAGE_KEYS } from '@/lib/app-config';
import {
  isRecord,
  isReviewSnapshot,
  isWorkspaceDraft,
  type ReviewSnapshot,
  type WorkspaceBackup,
  type WorkspaceDraft,
  type WorkspaceState,
} from '@/lib/workspace-schema';
import type { WorkspaceTask } from '@/lib/types';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const SUPPORTED_TASKS = new Set<WorkspaceTask>(['translate', 'polish', 'precheck']);

function parseValue(value: string | null): unknown {
  if (!value) return null;
  return JSON.parse(value) as unknown;
}

function normalizeDraft(value: WorkspaceDraft): WorkspaceDraft {
  const taskType = SUPPORTED_TASKS.has(value.taskType as WorkspaceTask) ? value.taskType as WorkspaceTask : 'precheck';
  const importedDocument = value.importedDocument?.fileType === 'docx' ? value.importedDocument : undefined;
  return {
    projectTitle: value.projectTitle,
    taskType,
    sourceText: value.sourceText,
    targetJournal: value.targetJournal,
    sectionType: value.sectionType,
    lockedTerms: Array.isArray(value.lockedTerms) ? value.lockedTerms : [],
    savedAt: value.savedAt,
    importedDocument,
  };
}

function supportedSnapshot(value: unknown): value is ReviewSnapshot {
  return isReviewSnapshot(value) && SUPPORTED_TASKS.has(value.taskType as WorkspaceTask);
}

export function readWorkspaceState(storage: StorageLike): WorkspaceState {
  const warnings: string[] = [];
  let draft: WorkspaceDraft | null = null;
  let history: ReviewSnapshot[] = [];

  try {
    const parsed = parseValue(storage.getItem(STORAGE_KEYS.draft));
    if (parsed !== null && isWorkspaceDraft(parsed)) {
      draft = normalizeDraft(parsed);
      if (parsed.taskType && !SUPPORTED_TASKS.has(parsed.taskType as WorkspaceTask)) {
        warnings.push('旧版审稿回复草稿已转换为投稿前预检，原文仍保留。');
      }
    } else if (parsed !== null) warnings.push('当前草稿格式无法识别，原始浏览器数据已保留。');
  } catch {
    warnings.push('当前草稿无法解析，原始浏览器数据已保留。');
  }

  try {
    const parsed = parseValue(storage.getItem(STORAGE_KEYS.history));
    if (Array.isArray(parsed)) {
      history = parsed.filter(supportedSnapshot).slice(0, MAX_HISTORY);
      if (parsed.some((item) => isReviewSnapshot(item) && !SUPPORTED_TASKS.has(item.taskType as WorkspaceTask))) {
        warnings.push('旧版审稿回复记录已隐藏，不会修改原始浏览器数据。');
      }
    } else if (parsed !== null) warnings.push('任务历史格式无法识别，原始浏览器数据已保留。');
  } catch {
    warnings.push('任务历史无法解析，原始浏览器数据已保留。');
  }

  return { draft, history, warnings };
}

export function writeWorkspaceDraft(storage: StorageLike, draft: WorkspaceDraft | null) {
  if (draft) storage.setItem(STORAGE_KEYS.draft, JSON.stringify(normalizeDraft(draft)));
  else storage.removeItem(STORAGE_KEYS.draft);
}

export function writeWorkspaceHistory(storage: StorageLike, history: ReviewSnapshot[]) {
  storage.setItem(STORAGE_KEYS.history, JSON.stringify(history.filter(supportedSnapshot).slice(0, MAX_HISTORY)));
}

export function upsertSnapshot(storage: StorageLike, snapshot: ReviewSnapshot) {
  const state = readWorkspaceState(storage);
  const next = [snapshot, ...state.history.filter((item) => item.id !== snapshot.id)].slice(0, MAX_HISTORY);
  writeWorkspaceHistory(storage, next);
  return next;
}

export function parseWorkspaceBackup(value: unknown): WorkspaceBackup {
  if (!isRecord(value)
    || value.format !== 'scholarforge-workspace-backup'
    || value.version !== 1
    || !Array.isArray(value.history)) {
    throw new Error('这不是受支持的 ScholarForge 工作区备份。');
  }

  return {
    format: 'scholarforge-workspace-backup',
    version: 1,
    exportedAt: typeof value.exportedAt === 'string' ? value.exportedAt : new Date().toISOString(),
    draft: value.draft === null || isWorkspaceDraft(value.draft) ? (value.draft ? normalizeDraft(value.draft) : null) : null,
    history: value.history.filter(supportedSnapshot).slice(0, MAX_HISTORY),
  };
}

export function createWorkspaceBackup(storage: StorageLike): WorkspaceBackup {
  const state = readWorkspaceState(storage);
  return {
    format: 'scholarforge-workspace-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    draft: state.draft,
    history: state.history,
  };
}
