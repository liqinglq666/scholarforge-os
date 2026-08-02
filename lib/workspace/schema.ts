import {
  LEGACY_DRAFT_KEY,
  LEGACY_HISTORY_KEY,
  MAX_BACKUP_BYTES,
  MAX_HISTORY_ENTRIES,
  MAX_PROJECTS,
  MAX_SOURCE_CHARACTERS,
} from '@/lib/config';
import type {
  AcademicStage,
  ChapterTemplateItem,
  EnglishVariant,
  ExplanationLevel,
  HistoryEntry,
  ImportedDocument,
  IssueDecision,
  ManuscriptChapter,
  ManuscriptProject,
  PersistedWorkspace,
  RevisionChange,
  RevisionChangeKind,
  RevisionChangeSource,
  RevisionComparison,
  ReviewIssue,
  ReviewResult,
  SectionType,
  SupervisorFeedbackItem,
  SupervisorFeedbackPriority,
  SupervisorFeedbackStatus,
  TaskType,
  TerminologyLock,
  UserPreferences,
  WorkspaceBackup,
  WorkspaceDraft,
  WorkspaceState,
} from '@/lib/types';
import { cleanSingleLine, cleanText, isRecord } from '@/lib/validation/common';

const TASKS = new Set<TaskType>(['translate', 'polish', 'precheck']);
const SECTIONS = new Set<SectionType>(['general', 'abstract', 'introduction', 'methods', 'results', 'discussion', 'conclusion']);
const DECISIONS = new Set<IssueDecision>(['pending', 'accepted', 'rejected', 'deferred']);
const ACADEMIC_STAGES = new Set<AcademicStage>(['masters', 'doctoral', 'postgraduate', 'researcher', 'other']);
const ENGLISH_VARIANTS = new Set<EnglishVariant>(['us', 'uk']);
const EXPLANATION_LEVELS = new Set<ExplanationLevel>(['brief', 'balanced', 'detailed']);
const FEEDBACK_STATUSES = new Set<SupervisorFeedbackStatus>(['pending', 'in_progress', 'completed', 'needs_clarification', 'not_adopted']);
const FEEDBACK_PRIORITIES = new Set<SupervisorFeedbackPriority>(['high', 'normal', 'low']);
const REVISION_KINDS = new Set<RevisionChangeKind>(['added', 'removed', 'modified']);
const REVISION_SOURCES = new Set<RevisionChangeSource>(['author', 'ai', 'supervisor', 'unknown']);
const MAX_PROJECT_CHAPTERS = 12;
const MAX_PROJECT_TERMS = 20;
const MAX_CUSTOM_RULES = 30;
const MAX_CHAPTER_TEMPLATE_ITEMS = 12;
const MAX_SUPERVISOR_FEEDBACK = 120;
const MAX_REVISION_COMPARISONS = 20;
const MAX_REVISION_CHANGES = 300;

function isoDate(value: unknown, fallback = new Date().toISOString()) {
  if (typeof value !== 'string') return fallback;
  return Number.isNaN(new Date(value).getTime()) ? fallback : value;
}

function createDefaultChapterTemplate(): ChapterTemplateItem[] {
  return [
    { id: crypto.randomUUID(), title: '摘要', sectionType: 'abstract' },
    { id: crypto.randomUUID(), title: '引言', sectionType: 'introduction' },
    { id: crypto.randomUUID(), title: '方法', sectionType: 'methods' },
    { id: crypto.randomUUID(), title: '结果', sectionType: 'results' },
    { id: crypto.randomUUID(), title: '讨论', sectionType: 'discussion' },
    { id: crypto.randomUUID(), title: '结论', sectionType: 'conclusion' },
  ];
}

export function createUserPreferences(overrides: Partial<UserPreferences> = {}): UserPreferences {
  return {
    displayName: overrides.displayName || '',
    discipline: overrides.discipline || '',
    academicStage: overrides.academicStage || 'masters',
    englishVariant: overrides.englishVariant || 'us',
    explanationLevel: overrides.explanationLevel || 'balanced',
    defaultTaskType: overrides.defaultTaskType || 'polish',
    defaultSectionType: overrides.defaultSectionType || 'general',
    defaultTargetJournal: overrides.defaultTargetJournal || '',
    customWritingRules: overrides.customWritingRules || [],
    chapterTemplate: overrides.chapterTemplate?.length ? overrides.chapterTemplate : createDefaultChapterTemplate(),
    updatedAt: overrides.updatedAt || new Date().toISOString(),
  };
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
    ...(overrides.linkedProjectId ? { linkedProjectId: overrides.linkedProjectId } : {}),
    ...(overrides.linkedChapterId ? { linkedChapterId: overrides.linkedChapterId } : {}),
    createdAt: overrides.createdAt || now,
    updatedAt: overrides.updatedAt || now,
  };
}

export function createDraftFromPreferences(
  preferences: UserPreferences,
  overrides: Partial<WorkspaceDraft> = {},
): WorkspaceDraft {
  return createDraft({
    taskType: preferences.defaultTaskType,
    sectionType: preferences.defaultSectionType,
    targetJournal: preferences.defaultTargetJournal,
    terminologyLocks: preferences.customWritingRules.map((item) => ({ ...item, id: crypto.randomUUID() })),
    ...overrides,
  });
}

export function createManuscriptChapter(overrides: Partial<ManuscriptChapter> = {}): ManuscriptChapter {
  const now = new Date().toISOString();
  return {
    id: overrides.id || crypto.randomUUID(),
    title: overrides.title || '未命名章节',
    sectionType: overrides.sectionType || 'general',
    text: overrides.text || '',
    createdAt: overrides.createdAt || now,
    updatedAt: overrides.updatedAt || now,
    ...(overrides.lastReviewedAt ? { lastReviewedAt: overrides.lastReviewedAt } : {}),
  };
}

export function createSupervisorFeedbackItem(overrides: Partial<SupervisorFeedbackItem> = {}): SupervisorFeedbackItem {
  const now = new Date().toISOString();
  return {
    id: overrides.id || crypto.randomUUID(),
    comment: overrides.comment || '',
    ...(overrides.chapterId ? { chapterId: overrides.chapterId } : {}),
    ...(overrides.location ? { location: overrides.location } : {}),
    status: overrides.status || 'pending',
    priority: overrides.priority || 'normal',
    authorResponse: overrides.authorResponse || '',
    createdAt: overrides.createdAt || now,
    updatedAt: overrides.updatedAt || now,
    ...(overrides.completedAt ? { completedAt: overrides.completedAt } : {}),
  };
}

export function createRevisionComparison(overrides: Partial<RevisionComparison> = {}): RevisionComparison {
  const now = new Date().toISOString();
  return {
    id: overrides.id || crypto.randomUUID(),
    title: overrides.title || '版本比较',
    ...(overrides.chapterId ? { chapterId: overrides.chapterId } : {}),
    baseLabel: overrides.baseLabel || '修改前',
    revisedLabel: overrides.revisedLabel || '修改后',
    baseText: overrides.baseText || '',
    revisedText: overrides.revisedText || '',
    changes: overrides.changes || [],
    createdAt: overrides.createdAt || now,
    updatedAt: overrides.updatedAt || now,
  };
}

export function createManuscriptProject(overrides: Partial<ManuscriptProject> = {}): ManuscriptProject {
  const now = new Date().toISOString();
  const chapters = overrides.chapters || [createManuscriptChapter({ title: '摘要', sectionType: 'abstract' })];
  return {
    id: overrides.id || crypto.randomUUID(),
    name: overrides.name || '',
    targetJournal: overrides.targetJournal || '',
    terminologyLocks: overrides.terminologyLocks || [],
    chapters,
    supervisorFeedback: overrides.supervisorFeedback || [],
    revisionComparisons: overrides.revisionComparisons || [],
    activeChapterId: overrides.activeChapterId || chapters[0]?.id,
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
  const preferences = createUserPreferences();
  return {
    version: 3,
    current: createWorkspaceState(createDraftFromPreferences(preferences)),
    history: [],
    projects: [],
    preferences,
    updatedAt: new Date().toISOString(),
  };
}

function parseLocks(value: unknown, limit = 20): TerminologyLock[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.slice(0, limit).flatMap((item, index) => {
    if (!isRecord(item)) return [];
    const source = cleanSingleLine(item.source, 120);
    const preferred = cleanSingleLine(item.preferred, 160);
    const key = source.toLocaleLowerCase();
    if (!source || !preferred || seen.has(key)) return [];
    seen.add(key);
    const note = cleanSingleLine(item.note, 240);
    return [{ id: cleanSingleLine(item.id, 80) || `term-${index + 1}`, source, preferred, ...(note ? { note } : {}) }];
  });
}

function parseChapterTemplate(value: unknown): ChapterTemplateItem[] {
  if (!Array.isArray(value)) return createDefaultChapterTemplate();
  const items = value.slice(0, MAX_CHAPTER_TEMPLATE_ITEMS).flatMap((item, index) => {
    if (!isRecord(item)) return [];
    const title = cleanSingleLine(item.title, 120);
    if (!title) return [];
    return [{
      id: cleanSingleLine(item.id, 80) || `template-${index + 1}`,
      title,
      sectionType: SECTIONS.has(item.sectionType as SectionType) ? item.sectionType as SectionType : 'general',
    }];
  });
  return items.length ? items : createDefaultChapterTemplate();
}

export function parseUserPreferences(value: unknown): UserPreferences {
  if (!isRecord(value)) return createUserPreferences();
  return createUserPreferences({
    displayName: cleanSingleLine(value.displayName, 80),
    discipline: cleanSingleLine(value.discipline, 100),
    academicStage: ACADEMIC_STAGES.has(value.academicStage as AcademicStage)
      ? value.academicStage as AcademicStage
      : 'masters',
    englishVariant: ENGLISH_VARIANTS.has(value.englishVariant as EnglishVariant)
      ? value.englishVariant as EnglishVariant
      : 'us',
    explanationLevel: EXPLANATION_LEVELS.has(value.explanationLevel as ExplanationLevel)
      ? value.explanationLevel as ExplanationLevel
      : 'balanced',
    defaultTaskType: TASKS.has(value.defaultTaskType as TaskType)
      ? value.defaultTaskType as TaskType
      : 'polish',
    defaultSectionType: SECTIONS.has(value.defaultSectionType as SectionType)
      ? value.defaultSectionType as SectionType
      : 'general',
    defaultTargetJournal: cleanSingleLine(value.defaultTargetJournal, 160),
    customWritingRules: parseLocks(value.customWritingRules, MAX_CUSTOM_RULES),
    chapterTemplate: parseChapterTemplate(value.chapterTemplate),
    updatedAt: isoDate(value.updatedAt),
  });
}

function parseImportedDocument(value: unknown): ImportedDocument | undefined {
  if (!isRecord(value)) return undefined;
  const fileName = cleanSingleLine(value.fileName, 180);
  if (!fileName) return undefined;
  return {
    fileName,
    importedAt: isoDate(value.importedAt),
    warnings: Array.isArray(value.warnings)
      ? value.warnings.flatMap((item) => typeof item === 'string' ? [cleanSingleLine(item, 500)] : []).slice(0, 10)
      : [],
  };
}

function parseDraft(value: unknown): WorkspaceDraft {
  if (!isRecord(value)) return createDraft();
  const createdAt = isoDate(value.createdAt);
  const sourceText = cleanText(value.sourceText, MAX_SOURCE_CHARACTERS);
  const importedDocument = parseImportedDocument(value.importedDocument);
  return createDraft({
    id: cleanSingleLine(value.id, 80) || crypto.randomUUID(),
    projectName: cleanSingleLine(value.projectName, 120),
    taskType: TASKS.has(value.taskType as TaskType) ? value.taskType as TaskType : 'polish',
    sectionType: SECTIONS.has(value.sectionType as SectionType) ? value.sectionType as SectionType : 'general',
    targetJournal: cleanSingleLine(value.targetJournal, 160),
    sourceText,
    terminologyLocks: parseLocks(value.terminologyLocks),
    ...(importedDocument ? { importedDocument } : {}),
    linkedProjectId: cleanSingleLine(value.linkedProjectId, 80) || undefined,
    linkedChapterId: cleanSingleLine(value.linkedChapterId, 80) || undefined,
    createdAt,
    updatedAt: isoDate(value.updatedAt, createdAt),
  });
}

function parseChapter(value: unknown, index: number): ManuscriptChapter | null {
  if (!isRecord(value)) return null;
  const createdAt = isoDate(value.createdAt);
  return createManuscriptChapter({
    id: cleanSingleLine(value.id, 80) || `chapter-${index + 1}`,
    title: cleanSingleLine(value.title, 120) || `章节 ${index + 1}`,
    sectionType: SECTIONS.has(value.sectionType as SectionType) ? value.sectionType as SectionType : 'general',
    text: cleanText(value.text, MAX_SOURCE_CHARACTERS),
    createdAt,
    updatedAt: isoDate(value.updatedAt, createdAt),
    lastReviewedAt: typeof value.lastReviewedAt === 'string' ? isoDate(value.lastReviewedAt) : undefined,
  });
}

function parseFeedback(value: unknown, index: number, chapterIds: Set<string>): SupervisorFeedbackItem | null {
  if (!isRecord(value)) return null;
  const comment = cleanText(value.comment, 3_000);
  if (!comment) return null;
  const createdAt = isoDate(value.createdAt);
  const chapterId = cleanSingleLine(value.chapterId, 80);
  const status = FEEDBACK_STATUSES.has(value.status as SupervisorFeedbackStatus)
    ? value.status as SupervisorFeedbackStatus
    : 'pending';
  return createSupervisorFeedbackItem({
    id: cleanSingleLine(value.id, 80) || `feedback-${index + 1}`,
    comment,
    chapterId: chapterIds.has(chapterId) ? chapterId : undefined,
    location: cleanSingleLine(value.location, 240) || undefined,
    status,
    priority: FEEDBACK_PRIORITIES.has(value.priority as SupervisorFeedbackPriority)
      ? value.priority as SupervisorFeedbackPriority
      : 'normal',
    authorResponse: cleanText(value.authorResponse, 4_000),
    createdAt,
    updatedAt: isoDate(value.updatedAt, createdAt),
    completedAt: status === 'completed' && typeof value.completedAt === 'string' ? isoDate(value.completedAt) : undefined,
  });
}

function parseRevisionChange(value: unknown, index: number, feedbackIds: Set<string>): RevisionChange | null {
  if (!isRecord(value)) return null;
  const before = cleanText(value.before, 4_000);
  const after = cleanText(value.after, 4_000);
  if (!before && !after) return null;
  const feedbackId = cleanSingleLine(value.feedbackId, 80);
  return {
    id: cleanSingleLine(value.id, 80) || `change-${index + 1}`,
    kind: REVISION_KINDS.has(value.kind as RevisionChangeKind) ? value.kind as RevisionChangeKind : 'modified',
    before,
    after,
    source: REVISION_SOURCES.has(value.source as RevisionChangeSource) ? value.source as RevisionChangeSource : 'unknown',
    reason: cleanText(value.reason, 1_500),
    ...(feedbackIds.has(feedbackId) ? { feedbackId } : {}),
  };
}

function parseRevisionComparison(
  value: unknown,
  index: number,
  chapterIds: Set<string>,
  feedbackIds: Set<string>,
): RevisionComparison | null {
  if (!isRecord(value)) return null;
  const baseText = cleanText(value.baseText, MAX_SOURCE_CHARACTERS);
  const revisedText = cleanText(value.revisedText, MAX_SOURCE_CHARACTERS);
  if (!baseText && !revisedText) return null;
  const createdAt = isoDate(value.createdAt);
  const chapterId = cleanSingleLine(value.chapterId, 80);
  const changes = Array.isArray(value.changes)
    ? value.changes.slice(0, MAX_REVISION_CHANGES)
      .map((change, changeIndex) => parseRevisionChange(change, changeIndex, feedbackIds))
      .filter((change): change is RevisionChange => change !== null)
    : [];
  return createRevisionComparison({
    id: cleanSingleLine(value.id, 80) || `comparison-${index + 1}`,
    title: cleanSingleLine(value.title, 160) || `版本比较 ${index + 1}`,
    chapterId: chapterIds.has(chapterId) ? chapterId : undefined,
    baseLabel: cleanSingleLine(value.baseLabel, 80) || '修改前',
    revisedLabel: cleanSingleLine(value.revisedLabel, 80) || '修改后',
    baseText,
    revisedText,
    changes,
    createdAt,
    updatedAt: isoDate(value.updatedAt, createdAt),
  });
}

function parseProject(value: unknown): ManuscriptProject | null {
  if (!isRecord(value)) return null;
  const createdAt = isoDate(value.createdAt);
  const chapters = Array.isArray(value.chapters)
    ? value.chapters.slice(0, MAX_PROJECT_CHAPTERS).map(parseChapter).filter((chapter): chapter is ManuscriptChapter => chapter !== null)
    : [];
  const safeChapters = chapters.length ? chapters : [createManuscriptChapter({ title: '摘要', sectionType: 'abstract' })];
  const chapterIds = new Set(safeChapters.map((chapter) => chapter.id));
  const feedback = Array.isArray(value.supervisorFeedback)
    ? value.supervisorFeedback.slice(0, MAX_SUPERVISOR_FEEDBACK)
      .map((item, index) => parseFeedback(item, index, chapterIds))
      .filter((item): item is SupervisorFeedbackItem => item !== null)
    : [];
  const feedbackIds = new Set(feedback.map((item) => item.id));
  const comparisons = Array.isArray(value.revisionComparisons)
    ? value.revisionComparisons.slice(0, MAX_REVISION_COMPARISONS)
      .map((item, index) => parseRevisionComparison(item, index, chapterIds, feedbackIds))
      .filter((item): item is RevisionComparison => item !== null)
    : [];
  const requestedActiveId = cleanSingleLine(value.activeChapterId, 80);
  return createManuscriptProject({
    id: cleanSingleLine(value.id, 80) || crypto.randomUUID(),
    name: cleanSingleLine(value.name, 120),
    targetJournal: cleanSingleLine(value.targetJournal, 160),
    terminologyLocks: parseLocks(value.terminologyLocks, MAX_PROJECT_TERMS),
    chapters: safeChapters,
    supervisorFeedback: feedback,
    revisionComparisons: comparisons,
    activeChapterId: safeChapters.some((chapter) => chapter.id === requestedActiveId) ? requestedActiveId : safeChapters[0].id,
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
  if (!isRecord(value) || (value.version !== 2 && value.version !== 3)) return createPersistedWorkspace();
  const projects = value.version === 3 && Array.isArray(value.projects)
    ? value.projects.map(parseProject).filter((project): project is ManuscriptProject => project !== null).slice(0, MAX_PROJECTS)
    : (() => {
        const legacyProject = parseProject(value.project);
        return legacyProject ? [legacyProject] : [];
      })();
  const requestedActiveProjectId = cleanSingleLine(value.activeProjectId, 80);
  const activeProjectId = projects.some((project) => project.id === requestedActiveProjectId)
    ? requestedActiveProjectId
    : projects[0]?.id;
  return {
    version: 3,
    current: sanitizeWorkspaceState(value.current),
    history: parseHistory(value.history),
    projects,
    ...(activeProjectId ? { activeProjectId } : {}),
    preferences: parseUserPreferences(value.preferences),
    updatedAt: isoDate(value.updatedAt),
  };
}

export function parseBackupText(text: string): WorkspaceBackup {
  if (new Blob([text]).size > MAX_BACKUP_BYTES) throw new Error('备份文件超过 8 MB 限制。');
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    throw new Error('备份文件不是有效 JSON。');
  }
  if (!isRecord(raw) || raw.format !== 'scholarforge-workspace' || (raw.version !== 2 && raw.version !== 3)) {
    throw new Error('这不是受支持的 ScholarForge 工作区备份。');
  }
  const parsed = parsePersistedWorkspace({
    version: raw.version,
    current: raw.current,
    history: raw.history,
    project: raw.project,
    projects: raw.projects,
    activeProjectId: raw.activeProjectId,
    preferences: raw.preferences,
    updatedAt: raw.exportedAt,
  });
  return {
    format: 'scholarforge-workspace',
    version: 3,
    exportedAt: isoDate(raw.exportedAt),
    current: parsed.current,
    history: parsed.history,
    projects: parsed.projects,
    ...(parsed.activeProjectId ? { activeProjectId: parsed.activeProjectId } : {}),
    preferences: parsed.preferences,
  };
}

export function createBackup(data: PersistedWorkspace): WorkspaceBackup {
  const parsed = parsePersistedWorkspace(data);
  return {
    format: 'scholarforge-workspace',
    version: 3,
    exportedAt: new Date().toISOString(),
    current: parsed.current,
    history: parsed.history,
    projects: parsed.projects,
    ...(parsed.activeProjectId ? { activeProjectId: parsed.activeProjectId } : {}),
    preferences: parsed.preferences,
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
  const preferences = createUserPreferences({ defaultTaskType: taskType, defaultSectionType: sectionType });
  const draft = createDraft({
    projectName: cleanSingleLine(legacyDraft.projectTitle, 120),
    taskType,
    sectionType,
    targetJournal: cleanSingleLine(legacyDraft.targetJournal, 160),
    sourceText: cleanText(legacyDraft.sourceText, MAX_SOURCE_CHARACTERS),
    terminologyLocks: parseLocks(legacyDraft.lockedTerms),
  });
  return {
    version: 3,
    current: createWorkspaceState(draft),
    history: [],
    projects: [],
    preferences,
    updatedAt: new Date().toISOString(),
  };
}
