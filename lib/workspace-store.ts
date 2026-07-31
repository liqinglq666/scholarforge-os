import { MAX_HISTORY, STORAGE_KEYS } from '@/lib/app-config';
import { normalizeAppliedEdits } from '@/lib/author-editing';
import {
  isRecord,
  isReviewSnapshot,
  isWorkspaceDraft,
  type ReviewSnapshot,
  type WorkspaceBackup,
  type WorkspaceDraft,
  type WorkspaceState,
} from '@/lib/workspace-schema';
import type {
  AgentId,
  IssueDecision,
  IssueSeverity,
  ReviewIssue,
  ReviewOutputKind,
  ReviewResult,
  ReviewSection,
  TerminologyLock,
  WorkspaceTask,
} from '@/lib/types';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const SUPPORTED_TASKS = new Set<WorkspaceTask>(['translate', 'polish', 'precheck']);
const SUPPORTED_SECTIONS = new Set<ReviewSection>(['general', 'abstract', 'introduction', 'methods', 'results', 'discussion', 'conclusion']);
const SUPPORTED_AGENTS = new Set<AgentId>(['terminology', 'language', 'logic', 'method']);
const SUPPORTED_SEVERITIES = new Set<IssueSeverity>(['major', 'minor', 'suggestion']);
const SUPPORTED_DECISIONS = new Set<IssueDecision>(['pending', 'accepted', 'deferred', 'dismissed']);
const OUTPUT_KIND: Record<WorkspaceTask, ReviewOutputKind> = {
  translate: 'translation',
  polish: 'revision',
  precheck: 'precheck',
};

function boundedString(value: unknown, fallback = '', max = 12_000) {
  return typeof value === 'string' ? value.slice(0, max) : fallback;
}

function normalizeLocks(value: unknown): TerminologyLock[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.slice(0, 12).flatMap((item, index) => {
    if (!isRecord(item)) return [];
    const source = boundedString(item.source, '', 120).trim();
    const preferred = boundedString(item.preferred, '', 160).trim();
    if (!source || !preferred) return [];
    const requestedId = boundedString(item.id, '', 80).trim();
    let id = requestedId || `lock-${index + 1}`;
    while (seen.has(id)) id = `${id}-${index + 1}`;
    seen.add(id);
    return [{
      id,
      source,
      preferred,
      note: boundedString(item.note, '', 240).trim() || undefined,
    }];
  });
}

function normalizeIssues(value: unknown): ReviewIssue[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.slice(0, 40).flatMap((item, index) => {
    if (!isRecord(item)) return [];
    const agent = SUPPORTED_AGENTS.has(item.agent as AgentId) ? item.agent as AgentId : 'language';
    const severity = SUPPORTED_SEVERITIES.has(item.severity as IssueSeverity) ? item.severity as IssueSeverity : 'minor';
    const requestedId = boundedString(item.id, '', 120).trim();
    let id = requestedId || `${agent}-${index + 1}`;
    while (seen.has(id)) id = `${id}-${index + 1}`;
    seen.add(id);
    return [{
      id,
      agent,
      severity,
      location: boundedString(item.location, '未指定位置', 240),
      original: boundedString(item.original, '', 4_000),
      revised: boundedString(item.revised, '', 4_000),
      reason: boundedString(item.reason, '该建议需要作者核对。', 2_000),
      category: boundedString(item.category, '科研写作', 240),
      meaningChanged: item.meaningChanged === true,
    }];
  });
}

function normalizeDecisions(value: unknown, issues: ReviewIssue[]) {
  if (!isRecord(value)) return {};
  const issueIds = new Set(issues.map((issue) => issue.id));
  return Object.fromEntries(Object.entries(value).filter(([id, decision]) => (
    issueIds.has(id) && SUPPORTED_DECISIONS.has(decision as IssueDecision)
  ))) as Record<string, IssueDecision>;
}

function parseValue(value: string | null): unknown {
  if (!value) return null;
  return JSON.parse(value) as unknown;
}

function normalizeDraft(value: WorkspaceDraft): WorkspaceDraft {
  const taskType = SUPPORTED_TASKS.has(value.taskType as WorkspaceTask)
    ? value.taskType as WorkspaceTask
    : 'precheck';
  const sectionType = SUPPORTED_SECTIONS.has(value.sectionType as ReviewSection)
    ? value.sectionType as ReviewSection
    : 'general';
  const imported = isRecord(value.importedDocument) ? value.importedDocument : null;
  const importedDocument = imported?.fileType === 'docx'
    && typeof imported.fileName === 'string'
    && typeof imported.sectionTitle === 'string'
    && typeof imported.sourceLabel === 'string'
    && typeof imported.importedAt === 'string'
    ? {
      fileName: imported.fileName.slice(0, 240),
      fileType: 'docx' as const,
      sectionTitle: imported.sectionTitle.slice(0, 240),
      sourceLabel: imported.sourceLabel.slice(0, 240),
      importedAt: imported.importedAt,
    }
    : undefined;

  return {
    projectTitle: boundedString(value.projectTitle, '', 120),
    taskType,
    sourceText: boundedString(value.sourceText, '', 12_000),
    targetJournal: boundedString(value.targetJournal, '', 160),
    sectionType,
    lockedTerms: normalizeLocks(value.lockedTerms),
    savedAt: boundedString(value.savedAt, new Date().toISOString(), 80),
    importedDocument,
  };
}

function isLegacyDemoSnapshot(value: ReviewSnapshot) {
  const result = value.result as unknown as Record<string, unknown>;
  return result.mode === 'demo'
    || result.executionMode === 'safe-demo'
    || (typeof result.workflowVersion === 'string' && result.workflowVersion.toLowerCase().includes('demo'));
}

function supportedSnapshot(value: unknown): value is ReviewSnapshot {
  return isReviewSnapshot(value)
    && SUPPORTED_TASKS.has(value.taskType as WorkspaceTask)
    && !isLegacyDemoSnapshot(value);
}

function normalizeResult(result: ReviewResult, snapshot: ReviewSnapshot): ReviewResult {
  const current = { ...result } as Record<string, unknown>;
  delete current.mode;
  delete current.executionMode;
  delete current.workflowVersion;
  delete current.agentRuns;
  delete current.scoreBefore;
  delete current.scoreAfter;
  delete current.decision;
  delete current.decisionReason;
  delete current.guardrails;
  delete current.terminology;

  const taskType = SUPPORTED_TASKS.has(snapshot.taskType as WorkspaceTask)
    ? snapshot.taskType as WorkspaceTask
    : 'precheck';
  const sectionType = SUPPORTED_SECTIONS.has(snapshot.sectionType as ReviewSection)
    ? snapshot.sectionType as ReviewSection
    : 'general';
  const lockedTerms = normalizeLocks(snapshot.lockedTerms);

  return {
    outputKind: OUTPUT_KIND[taskType],
    profile: {
      projectTitle: boundedString(snapshot.projectTitle, '未命名科研写作任务', 120),
      taskType,
      sectionType,
      targetJournal: boundedString(snapshot.targetJournal, '', 160),
      lockedTerms,
    },
    summary: boundedString(current.summary, '历史分析结果已恢复，请作者继续逐条核对。', 2_000),
    revisedText: boundedString(current.revisedText, snapshot.sourceText, 48_000),
    issues: normalizeIssues(current.issues),
    generatedAt: boundedString(current.generatedAt, snapshot.savedAt || new Date().toISOString(), 80),
  };
}

function normalizeSnapshot(value: ReviewSnapshot): ReviewSnapshot {
  const taskType = SUPPORTED_TASKS.has(value.taskType as WorkspaceTask)
    ? value.taskType as WorkspaceTask
    : 'precheck';
  const sectionType = SUPPORTED_SECTIONS.has(value.sectionType as ReviewSection)
    ? value.sectionType as ReviewSection
    : 'general';
  const sourceText = boundedString(value.sourceText, '', 12_000);
  const lockedTerms = normalizeLocks(value.lockedTerms);
  const base = {
    ...value,
    projectTitle: boundedString(value.projectTitle, '未命名科研写作任务', 120),
    taskType,
    sourceText,
    targetJournal: boundedString(value.targetJournal, '', 160),
    sectionType,
    lockedTerms,
    requestId: boundedString(value.requestId, '', 120),
    savedAt: boundedString(value.savedAt, new Date().toISOString(), 80),
  } as ReviewSnapshot;
  const result = normalizeResult(value.result, base);
  const decisions = normalizeDecisions(value.decisions, result.issues);
  const edits = normalizeAppliedEdits(
    sourceText,
    Array.isArray(value.appliedEdits) ? value.appliedEdits : [],
  ).valid;

  return {
    id: boundedString(value.id, crypto.randomUUID(), 120),
    projectTitle: base.projectTitle,
    taskType,
    sourceText,
    targetJournal: base.targetJournal,
    sectionType,
    lockedTerms,
    requestId: base.requestId,
    result,
    decisions,
    appliedEdits: edits,
    savedAt: base.savedAt,
  };
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
    } else if (parsed !== null) {
      warnings.push('当前草稿格式无法识别，原始浏览器数据已保留。');
    }
  } catch {
    warnings.push('当前草稿无法解析，原始浏览器数据已保留。');
  }

  try {
    const parsed = parseValue(storage.getItem(STORAGE_KEYS.history));
    if (Array.isArray(parsed)) {
      history = parsed.filter(supportedSnapshot).map(normalizeSnapshot).slice(0, MAX_HISTORY);

      if (parsed.some((item) => isReviewSnapshot(item) && !SUPPORTED_TASKS.has(item.taskType as WorkspaceTask))) {
        warnings.push('旧版审稿回复记录已隐藏，不会修改原始浏览器数据。');
      }
      if (parsed.some((item) => isReviewSnapshot(item) && isLegacyDemoSnapshot(item))) {
        warnings.push('旧版演示分析记录已隐藏，不会修改原始浏览器数据。');
      }
    } else if (parsed !== null) {
      warnings.push('任务历史格式无法识别，原始浏览器数据已保留。');
    }
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
  const normalized = history
    .filter(supportedSnapshot)
    .map(normalizeSnapshot)
    .slice(0, MAX_HISTORY);
  storage.setItem(STORAGE_KEYS.history, JSON.stringify(normalized));
}

export function upsertSnapshot(storage: StorageLike, snapshot: ReviewSnapshot) {
  const normalizedSnapshot = normalizeSnapshot(snapshot);
  const state = readWorkspaceState(storage);
  const next = [
    normalizedSnapshot,
    ...state.history.filter((item) => item.id !== normalizedSnapshot.id),
  ].slice(0, MAX_HISTORY);
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
    draft: value.draft === null || isWorkspaceDraft(value.draft)
      ? (value.draft ? normalizeDraft(value.draft) : null)
      : null,
    history: value.history
      .filter(supportedSnapshot)
      .map(normalizeSnapshot)
      .slice(0, MAX_HISTORY),
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
