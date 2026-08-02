import {
  LEGACY_DRAFT_KEY,
  LEGACY_HISTORY_KEY,
  MAX_BACKUP_BYTES,
  MAX_HISTORY_ENTRIES,
  MAX_SOURCE_CHARACTERS,
} from '@/lib/config';
import type {
  HistoryEntry,
  IssueDecision,
  PersistedWorkspace,
  ReviewIssue,
  ReviewResult,
  SectionType,
  TaskType,
  TerminologyLock,
  WorkspaceBackup,
  WorkspaceDraft,
  WorkspaceState,
} from '@/lib/types';
import { cleanSingleLine, cleanText, isRecord } from '@/lib/validation/common';

const TASKS = new Set<TaskType>(['translate', 'polish', 'precheck']);
const SECTIONS = new Set<SectionType>(['general', 'abstract', 'introduction', 'methods', 'results', 'discussion', 'conclusion']);
const DECISIONS = new Set<IssueDecision>(['pending', 'accepted', 'rejected', 'deferred']);

function isoDate(value: unknown, fallback = new Date().toISOString()) {
  if (typeof value !== 'string') return fallback;
  return Number.isNaN(new Date(value).getTime()) ? fallback : value;
}

export function createDraft(overrides: Partial<WorkspaceDraft> = {}): WorkspaceDraft {
  const now = new Date().toISOString();
  return {
    id: overrides.id || crypto.randomUUID(),
    projectName: overrides.projectName || '',
    taskType: overrides.taskType || 'polish',
    sectionType: overrides.sectionType || 'general',
    targetJournal: overrides.targetJournal || '',
    sourceText: overrides.sourceText || '',
    terminologyLocks: overrides.terminologyLocks || [],
    ...(overrides.importedDocument ? { importedDocument: overrides.importedDocument } : {}),
    createdAt: overrides.createdAt || now,
    updatedAt: overrides.updatedAt || now,
  };
}

export function createWorkspaceState(draft = createDraft()): WorkspaceState {
  return {
    version: 2,
    draft,
    currentResult: null,
    decisions: {},
    appliedEdits: [],
    undoStack: [],
    redoStack: [],
    workingText: draft.sourceText,
    status: 'draft',
  };
}

export function createPersistedWorkspace(): PersistedWorkspace {
  return { version: 2, current: createWorkspaceState(), history: [], updatedAt: new Date().toISOString() };
}

function parseLocks(value: unknown): TerminologyLock[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).flatMap((item, index) => {
    if (!isRecord(item)) return [];
    const source = cleanSingleLine(item.source, 120);
    const preferred = cleanSingleLine(item.preferred, 160);
    if (!source || !preferred) return [];
    const note = cleanSingleLine(item.note, 240);
    return [{ id: cleanSingleLine(item.id, 80) || `term-${index + 1}`, source, preferred, ...(note ? { note } : {}) }];
  });
}

function parseDraft(value: unknown): WorkspaceDraft {
  if (!isRecord(value)) return createDraft();
  const createdAt = isoDate(value.createdAt);
  const sourceText = cleanText(value.sourceText, MAX_SOURCE_CHARACTERS);
  return createDraft({
    id: cleanSingleLine(value.id, 80) || crypto.randomUUID(),
    projectName: cleanSingleLine(value.projectName, 120),
    taskType: TASKS.has(value.taskType as TaskType) ? value.taskType as TaskType : 'polish',
    sectionType: SECTIONS.has(value.sectionType as SectionType) ? value.sectionType as SectionType : 'general',
    targetJournal: cleanSingleLine(value.targetJournal, 160),
    sourceText,
    terminologyLocks: parseLocks(value.terminologyLocks),
    createdAt,
    updatedAt: isoDate(value.updatedAt, createdAt),
  });
}

function parseIssue(value: unknown, index: number): ReviewIssue | null {
  if (!isRecord(value)) return null;
  const severity = value.severity === 'major' || value.severity === 'minor' ? value.severity : 'suggestion';
  return {
    id: cleanSingleLine(value.id, 80) || `issue-${index + 1}`,
    category: cleanSingleLine(value.category, 120) || 'General',
    severity,
    location: cleanSingleLine(value.location, 240) || '位置未说明',
    original: cleanText(value.original, 4_000),
    revised: cleanText(value.revised, 4_000),
    reason: cleanText(value.reason, 1_500),
    meaningChanged: value.meaningChanged === true,
    authorActionRequired: value.authorActionRequired === true,
    safeToApply: value.safeToApply === true,
    ...(typeof value.safetyReason === 'string' ? { safetyReason: cleanSingleLine(value.safetyReason, 320) } : {}),
  };
}

function parseResult(value: unknown, taskId: string): ReviewResult | null {
  if (!isRecord(value) || !Array.isArray(value.issues)) return null;
  return {
    id: cleanSingleLine(value.id, 80) || crypto.randomUUID(),
    taskId,
    summary: cleanText(value.summary, 2_000),
    suggestedText: cleanText(value.suggestedText, 100_000),
    issues: value.issues.map(parseIssue).filter((issue): issue is ReviewIssue => issue !== null),
    warnings: Array.isArray(value.warnings) ? value.warnings.flatMap((item) => typeof item === 'string' ? [cleanSingleLine(item, 500)] : []).slice(0, 20) : [],
    generatedAt: isoDate(value.generatedAt),
  };
}

function parseDecisions(value: unknown, issues: ReviewIssue[]) {
  if (!isRecord(value)) return {};
  const issueIds = new Set(issues.map((issue) => issue.id));
  return Object.fromEntries(Object.entries(value).filter(([id, decision]) => issueIds.has(id) && DECISIONS.has(decision as IssueDecision))) as Record<string, IssueDecision>;
}

export function sanitizeWorkspaceState(value: unknown): WorkspaceState {
  if (!isRecord(value) || value.version !== 2) return createWorkspaceState();
  const draft = parseDraft(value.draft);
  const result = parseResult(value.currentResult, draft.id);
  const decisions = parseDecisions(value.decisions, result?.issues || []);

  // Applied edit offsets and replacement text from imported JSON are never trusted. Only the
  // referenced issue IDs are considered, and every edit is rebuilt from the current issue data.
  let workingText = draft.sourceText;
  const rebuiltEdits: WorkspaceState['appliedEdits'] = [];
  const requestedAppliedIds = new Set(
    Array.isArray(value.appliedEdits)
      ? value.appliedEdits.flatMap((edit) => isRecord(edit) && typeof edit.issueId === 'string' ? [edit.issueId] : [])
      : [],
  );
  for (const issue of result?.issues || []) {
    if (!requestedAppliedIds.has(issue.id) || !issue.safeToApply || issue.meaningChanged || issue.authorActionRequired) continue;
    const count = issue.original ? workingText.split(issue.original).length - 1 : 0;
    if (count !== 1 || issue.original.includes('\n\n') || issue.revised.includes('\n\n')) continue;
    const start = workingText.indexOf(issue.original);
    workingText = `${workingText.slice(0, start)}${issue.revised}${workingText.slice(start + issue.original.length)}`;
    rebuiltEdits.push({
      id: crypto.randomUUID(),
      issueId: issue.id,
      start,
      end: start + issue.original.length,
      original: issue.original,
      revised: issue.revised,
      appliedAt: new Date().toISOString(),
    });
  }

  return {
    version: 2,
    draft,
    currentResult: result,
    decisions,
    appliedEdits: rebuiltEdits,
    undoStack: [],
    redoStack: [],
    workingText,
    status: result ? 'reviewing' : 'draft',
    ...(typeof value.lastError === 'string' ? { lastError: cleanSingleLine(value.lastError, 500) } : {}),
    ...(typeof value.savedAt === 'string' ? { savedAt: isoDate(value.savedAt) } : {}),
  };
}

export function createHistoryEntry(workspace: WorkspaceState): HistoryEntry {
  const issues = workspace.currentResult?.issues || [];
  const resolvedIssueCount = issues.filter((issue) => {
    const decision = workspace.decisions[issue.id];
    return decision && decision !== 'pending';
  }).length;
  return {
    id: workspace.currentResult?.id || workspace.draft.id,
    projectName: workspace.draft.projectName || '未命名任务',
    taskType: workspace.draft.taskType,
    sectionType: workspace.draft.sectionType,
    sourceCharacterCount: workspace.draft.sourceText.length,
    issueCount: issues.length,
    resolvedIssueCount,
    savedAt: new Date().toISOString(),
    workspace: { ...workspace, undoStack: [], redoStack: [], savedAt: new Date().toISOString() },
  };
}

function parseHistory(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_HISTORY_ENTRIES).flatMap((item) => {
    if (!isRecord(item) || !isRecord(item.workspace)) return [];
    const workspace = sanitizeWorkspaceState(item.workspace);
    const entry = createHistoryEntry(workspace);
    return [{ ...entry, id: cleanSingleLine(item.id, 80) || entry.id, savedAt: isoDate(item.savedAt) }];
  });
}

export function parsePersistedWorkspace(value: unknown): PersistedWorkspace {
  if (!isRecord(value) || value.version !== 2) return createPersistedWorkspace();
  return {
    version: 2,
    current: sanitizeWorkspaceState(value.current),
    history: parseHistory(value.history),
    updatedAt: isoDate(value.updatedAt),
  };
}

export function parseBackupText(text: string): WorkspaceBackup {
  if (new Blob([text]).size > MAX_BACKUP_BYTES) throw new Error('备份文件超过 2 MB 限制。');
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    throw new Error('备份文件不是有效 JSON。');
  }
  if (!isRecord(raw) || raw.format !== 'scholarforge-workspace' || raw.version !== 2) {
    throw new Error('这不是受支持的 ScholarForge 工作区备份。');
  }
  const parsed = parsePersistedWorkspace({ version: 2, current: raw.current, history: raw.history, updatedAt: raw.exportedAt });
  return {
    format: 'scholarforge-workspace',
    version: 2,
    exportedAt: isoDate(raw.exportedAt),
    current: parsed.current,
    history: parsed.history,
  };
}

export function createBackup(data: PersistedWorkspace): WorkspaceBackup {
  return {
    format: 'scholarforge-workspace',
    version: 2,
    exportedAt: new Date().toISOString(),
    current: sanitizeWorkspaceState(data.current),
    history: parseHistory(data.history),
  };
}

interface LegacyStorageReader {
  getItem(key: string): string | null;
}

export function migrateLegacyWorkspace(storage: LegacyStorageReader): PersistedWorkspace | null {
  const rawDraft = storage.getItem(LEGACY_DRAFT_KEY);
  const rawHistory = storage.getItem(LEGACY_HISTORY_KEY);
  if (!rawDraft && !rawHistory) return null;

  let legacyDraft: Record<string, unknown> = {};
  let legacyHistory: unknown[] = [];
  try { legacyDraft = rawDraft && isRecord(JSON.parse(rawDraft)) ? JSON.parse(rawDraft) as Record<string, unknown> : {}; } catch { /* preserve by ignoring malformed legacy JSON */ }
  try { legacyHistory = rawHistory && Array.isArray(JSON.parse(rawHistory)) ? JSON.parse(rawHistory) as unknown[] : []; } catch { /* preserve by ignoring malformed legacy JSON */ }

  if (!cleanText(legacyDraft.sourceText, MAX_SOURCE_CHARACTERS) && legacyHistory.length) {
    const first = legacyHistory[0];
    if (isRecord(first)) legacyDraft = first;
  }

  const oldTask = legacyDraft.taskType;
  const taskType: TaskType = oldTask === 'translate' || oldTask === 'precheck' ? oldTask : 'polish';
  const sectionType = SECTIONS.has(legacyDraft.sectionType as SectionType) ? legacyDraft.sectionType as SectionType : 'general';
  const draft = createDraft({
    projectName: cleanSingleLine(legacyDraft.projectTitle, 120),
    taskType,
    sectionType,
    targetJournal: cleanSingleLine(legacyDraft.targetJournal, 160),
    sourceText: cleanText(legacyDraft.sourceText, MAX_SOURCE_CHARACTERS),
    terminologyLocks: parseLocks(legacyDraft.lockedTerms),
  });
  return { version: 2, current: createWorkspaceState(draft), history: [], updatedAt: new Date().toISOString() };
}
