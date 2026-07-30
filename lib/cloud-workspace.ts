import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  IssueDecision,
  ReviewMode,
  ReviewResult,
  ReviewSection,
  TerminologyLock,
  WorkspaceTask,
} from '@/lib/types';

export const DRAFT_KEY = 'scholarforge-os-paperlens-draft-v1';
export const HISTORY_KEY = 'scholarforge-os-paperlens-history-v1';
export const CLOUD_TABLE = 'scholarforge_projects';

export interface WorkspaceDraft {
  projectTitle?: string;
  taskType?: WorkspaceTask;
  sourceText?: string;
  supportingContext?: string;
  responseLocation?: string;
  targetJournal?: string;
  sectionType?: ReviewSection;
  reviewMode?: ReviewMode;
  lockedTerms?: TerminologyLock[];
  savedAt?: string;
}

export interface ReviewSnapshot {
  id: string;
  projectTitle: string;
  taskType: WorkspaceTask;
  sourceText: string;
  supportingContext: string;
  responseLocation: string;
  targetJournal: string;
  sectionType: ReviewSection;
  reviewMode: ReviewMode;
  lockedTerms: TerminologyLock[];
  requestId: string;
  result: ReviewResult;
  decisions: Record<string, IssueDecision>;
  savedAt: string;
}

export interface LocalWorkspacePayload {
  draft: WorkspaceDraft | null;
  history: ReviewSnapshot[];
}

export interface CloudProject {
  id: string;
  ownerId: string;
  projectKey: string;
  title: string;
  taskType: WorkspaceTask;
  targetJournal: string;
  sectionType: ReviewSection;
  reviewMode: ReviewMode;
  workspace: LocalWorkspacePayload;
  latestScore: number | null;
  pendingCount: number;
  createdAt: string;
  updatedAt: string;
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function readLocalWorkspace(): LocalWorkspacePayload {
  if (typeof window === 'undefined') return { draft: null, history: [] };
  return {
    draft: safeParse<WorkspaceDraft | null>(window.localStorage.getItem(DRAFT_KEY), null),
    history: safeParse<ReviewSnapshot[]>(window.localStorage.getItem(HISTORY_KEY), []),
  };
}

export function writeLocalWorkspace(payload: LocalWorkspacePayload) {
  if (typeof window === 'undefined') return;
  if (payload.draft) window.localStorage.setItem(DRAFT_KEY, JSON.stringify(payload.draft));
  else window.localStorage.removeItem(DRAFT_KEY);
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(payload.history.slice(0, 8)));
}

function normalized(value?: string) {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function hashString(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function projectKeyFromDraft(draft: WorkspaceDraft) {
  return hashString([
    normalized(draft.projectTitle),
    normalized(draft.taskType),
    normalized(draft.targetJournal),
  ].join('|'));
}

function draftFromSnapshot(snapshot: ReviewSnapshot): WorkspaceDraft {
  return {
    projectTitle: snapshot.projectTitle,
    taskType: snapshot.taskType,
    sourceText: snapshot.sourceText,
    supportingContext: snapshot.supportingContext,
    responseLocation: snapshot.responseLocation,
    targetJournal: snapshot.targetJournal,
    sectionType: snapshot.sectionType,
    reviewMode: snapshot.reviewMode,
    lockedTerms: snapshot.lockedTerms,
    savedAt: snapshot.savedAt,
  };
}

function snapshotMatchesDraft(snapshot: ReviewSnapshot, draft: WorkspaceDraft) {
  return projectKeyFromDraft(draftFromSnapshot(snapshot)) === projectKeyFromDraft(draft);
}

function pendingIssues(snapshot?: ReviewSnapshot) {
  if (!snapshot) return 0;
  return snapshot.result.issues.filter((issue) => (snapshot.decisions[issue.id] || 'pending') === 'pending').length;
}

function projectRecord(ownerId: string, draft: WorkspaceDraft, history: ReviewSnapshot[]) {
  const latest = history[0];
  const taskType = draft.taskType || latest?.taskType || 'precheck';
  const sectionType = draft.sectionType || latest?.sectionType || 'general';
  const reviewMode = draft.reviewMode || latest?.reviewMode || 'balanced';
  const title = draft.projectTitle?.trim() || latest?.projectTitle || 'Untitled research project';
  const targetJournal = draft.targetJournal || latest?.targetJournal || '';
  const workspace: LocalWorkspacePayload = { draft, history: history.slice(0, 8) };

  return {
    owner_id: ownerId,
    project_key: projectKeyFromDraft({ ...draft, projectTitle: title, taskType, targetJournal }),
    title,
    task_type: taskType,
    target_journal: targetJournal,
    section_type: sectionType,
    review_mode: reviewMode,
    workspace_payload: workspace,
    latest_score: Number.isFinite(latest?.result.scoreAfter) ? latest.result.scoreAfter : null,
    pending_count: pendingIssues(latest),
    last_run_at: latest?.savedAt || null,
  };
}

function cloudProjectFromRow(row: Record<string, unknown>): CloudProject {
  const payload = (row.workspace_payload || {}) as Partial<LocalWorkspacePayload>;
  return {
    id: String(row.id || ''),
    ownerId: String(row.owner_id || ''),
    projectKey: String(row.project_key || ''),
    title: String(row.title || 'Untitled research project'),
    taskType: (row.task_type || 'precheck') as WorkspaceTask,
    targetJournal: String(row.target_journal || ''),
    sectionType: (row.section_type || 'general') as ReviewSection,
    reviewMode: (row.review_mode || 'balanced') as ReviewMode,
    workspace: {
      draft: payload.draft || null,
      history: Array.isArray(payload.history) ? payload.history : [],
    },
    latestScore: typeof row.latest_score === 'number' ? row.latest_score : null,
    pendingCount: typeof row.pending_count === 'number' ? row.pending_count : 0,
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
}

export function isMissingCloudSchema(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  return /scholarforge_projects|relation .* does not exist|42P01/i.test(message);
}

export async function listCloudProjects(client: SupabaseClient, ownerId: string) {
  const { data, error } = await client
    .from(CLOUD_TABLE)
    .select('id, owner_id, project_key, title, task_type, target_journal, section_type, review_mode, workspace_payload, latest_score, pending_count, created_at, updated_at')
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []).map((row) => cloudProjectFromRow(row as Record<string, unknown>));
}

export async function syncCurrentLocalProject(client: SupabaseClient, ownerId: string) {
  const local = readLocalWorkspace();
  const draft = local.draft || (local.history[0] ? draftFromSnapshot(local.history[0]) : null);
  if (!draft) throw new Error('当前浏览器没有可同步的草稿或任务历史。');

  const relatedHistory = local.history.filter((snapshot) => snapshotMatchesDraft(snapshot, draft));
  const record = projectRecord(ownerId, draft, relatedHistory);
  const { data, error } = await client
    .from(CLOUD_TABLE)
    .upsert(record, { onConflict: 'owner_id,project_key' })
    .select('id, owner_id, project_key, title, task_type, target_journal, section_type, review_mode, workspace_payload, latest_score, pending_count, created_at, updated_at')
    .single();

  if (error) throw new Error(error.message);
  return cloudProjectFromRow(data as Record<string, unknown>);
}

export async function syncAllLocalProjects(client: SupabaseClient, ownerId: string) {
  const local = readLocalWorkspace();
  const groups = new Map<string, { draft: WorkspaceDraft; history: ReviewSnapshot[] }>();

  for (const snapshot of local.history) {
    const draft = draftFromSnapshot(snapshot);
    const key = projectKeyFromDraft(draft);
    const group = groups.get(key) || { draft, history: [] };
    group.history.push(snapshot);
    groups.set(key, group);
  }

  if (local.draft) {
    const key = projectKeyFromDraft(local.draft);
    const group = groups.get(key) || { draft: local.draft, history: [] };
    group.draft = local.draft;
    groups.set(key, group);
  }

  if (!groups.size) throw new Error('当前浏览器没有可迁移的项目。');

  const records = Array.from(groups.values()).map((group) => projectRecord(ownerId, group.draft, group.history));
  const { data, error } = await client
    .from(CLOUD_TABLE)
    .upsert(records, { onConflict: 'owner_id,project_key' })
    .select('id, owner_id, project_key, title, task_type, target_journal, section_type, review_mode, workspace_payload, latest_score, pending_count, created_at, updated_at');

  if (error) throw new Error(error.message);
  return (data || []).map((row) => cloudProjectFromRow(row as Record<string, unknown>));
}

export async function deleteCloudProject(client: SupabaseClient, ownerId: string, projectId: string) {
  const { error } = await client
    .from(CLOUD_TABLE)
    .delete()
    .eq('owner_id', ownerId)
    .eq('id', projectId);
  if (error) throw new Error(error.message);
}
