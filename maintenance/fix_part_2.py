from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one match, found {count}')
    target.write_text(text.replace(old, new, 1), encoding='utf-8')


def append_before_last(path: str, marker: str, addition: str) -> None:
    target = Path(path)
    text = target.read_text(encoding='utf-8')
    index = text.rfind(marker)
    if index < 0:
        raise RuntimeError(f'{path}: marker not found')
    target.write_text(text[:index] + addition + text[index:], encoding='utf-8')


# 4. Normalize legacy snapshots, decisions, locks, and persisted edit ranges.
replace_once(
    'lib/workspace-store.ts',
    """import { MAX_HISTORY, STORAGE_KEYS } from '@/lib/app-config';
""",
    """import { MAX_HISTORY, STORAGE_KEYS } from '@/lib/app-config';
import { normalizeAppliedEdits } from '@/lib/author-editing';
""",
)
replace_once(
    'lib/workspace-store.ts',
    """import type { IssueDecision, ReviewResult, WorkspaceTask } from '@/lib/types';
""",
    """import type {
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
""",
)
replace_once(
    'lib/workspace-store.ts',
    """const SUPPORTED_TASKS = new Set<WorkspaceTask>(['translate', 'polish', 'precheck']);
""",
    """const SUPPORTED_TASKS = new Set<WorkspaceTask>(['translate', 'polish', 'precheck']);
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
""",
)
replace_once(
    'lib/workspace-store.ts',
    """function normalizeDraft(value: WorkspaceDraft): WorkspaceDraft {
  const taskType = SUPPORTED_TASKS.has(value.taskType as WorkspaceTask)
    ? value.taskType as WorkspaceTask
    : 'precheck';
  const importedDocument = value.importedDocument?.fileType === 'docx'
    ? value.importedDocument
    : undefined;

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
""",
    """function normalizeDraft(value: WorkspaceDraft): WorkspaceDraft {
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
""",
)
replace_once(
    'lib/workspace-store.ts',
    """function normalizeResult(result: ReviewResult): ReviewResult {
  const current = { ...result } as Record<string, unknown>;
  delete current.mode;
  delete current.executionMode;
  delete current.workflowVersion;
  delete current.agentRuns;
  delete current.scoreBefore;
  delete current.scoreAfter;
  delete current.decisionReason;
  return current as unknown as ReviewResult;
}

function normalizeSnapshot(value: ReviewSnapshot): ReviewSnapshot {
  return {
    id: value.id,
    projectTitle: value.projectTitle,
    taskType: value.taskType,
    sourceText: value.sourceText,
    targetJournal: value.targetJournal,
    sectionType: value.sectionType,
    lockedTerms: Array.isArray(value.lockedTerms) ? value.lockedTerms : [],
    requestId: value.requestId || '',
    result: normalizeResult(value.result),
    decisions: isRecord(value.decisions)
      ? value.decisions as Record<string, IssueDecision>
      : {},
    appliedEdits: Array.isArray(value.appliedEdits) ? value.appliedEdits : [],
    savedAt: value.savedAt,
  };
}
""",
    """function normalizeResult(result: ReviewResult, snapshot: ReviewSnapshot): ReviewResult {
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
""",
)


print('Applied reliability fixes part 2.')
