import type { AppliedEdit, ReviewIssue, UndoFrame, WorkspaceState } from '@/lib/types';
import { hasDangerousPlaceholder } from '@/lib/validation/common';

export type AnchorState =
  | 'safe-exact'
  | 'safe-whitespace'
  | 'already-applied'
  | 'ambiguous'
  | 'missing'
  | 'manual';

export interface AnchorAnalysis {
  state: AnchorState;
  message: string;
  start?: number;
  end?: number;
  matchedText?: string;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function exactMatches(source: string, target: string) {
  const matches: Array<{ start: number; end: number; text: string }> = [];
  let cursor = 0;
  while (cursor <= source.length) {
    const start = source.indexOf(target, cursor);
    if (start < 0) break;
    matches.push({ start, end: start + target.length, text: target });
    cursor = start + Math.max(1, target.length);
  }
  return matches;
}

function whitespaceMatches(source: string, target: string) {
  const tokens = target.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const expression = new RegExp(tokens.map(escapeRegExp).join('\\s+'), 'gu');
  return Array.from(source.matchAll(expression), (match) => ({
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
    text: match[0],
  }));
}

export function analyzeIssueAnchor(
  workingText: string,
  issue: ReviewIssue,
  appliedEdits: AppliedEdit[],
): AnchorAnalysis {
  if (appliedEdits.some((edit) => edit.issueId === issue.id)) {
    return { state: 'already-applied', message: '这条建议已经应用到作者工作稿。' };
  }
  if (!issue.safeToApply) {
    return { state: 'manual', message: issue.safetyReason || '这条建议需要作者手动核对。' };
  }

  const original = issue.original.trim();
  const revised = issue.revised.trim();
  if (!original || !revised) {
    return { state: 'manual', message: '缺少可定位的原文或建议文本。' };
  }
  if (original === revised) {
    return { state: 'manual', message: '建议与原文相同，无需自动替换。' };
  }
  if (original.length < 4) {
    return { state: 'manual', message: '原文片段过短，自动定位风险过高。' };
  }
  if (original.includes('\n\n') || revised.includes('\n\n')) {
    return { state: 'manual', message: '建议跨越段落，必须由作者手动处理。' };
  }
  if (issue.meaningChanged || issue.authorActionRequired || hasDangerousPlaceholder(revised)) {
    return { state: 'manual', message: '建议可能改变科学含义或包含作者待补内容。' };
  }

  let matches = exactMatches(workingText, original);
  let state: AnchorState = 'safe-exact';
  if (!matches.length) {
    matches = whitespaceMatches(workingText, original);
    state = 'safe-whitespace';
  }
  if (!matches.length) {
    return { state: 'missing', message: '当前工作稿中找不到对应原文，锚点可能已失效。' };
  }
  if (matches.length > 1) {
    return { state: 'ambiguous', message: `当前工作稿中有 ${matches.length} 处相同文本，无法安全定位。` };
  }

  return {
    state,
    start: matches[0].start,
    end: matches[0].end,
    matchedText: matches[0].text,
    message: state === 'safe-exact' ? '原文唯一精确匹配，可以应用。' : '忽略空白差异后唯一匹配，可以应用。',
  };
}

function frameFrom(state: WorkspaceState): UndoFrame {
  return { workingText: state.workingText, appliedEdits: state.appliedEdits };
}

function applyIssueWithoutHistory(
  workingText: string,
  appliedEdits: AppliedEdit[],
  issue: ReviewIssue,
): { workingText: string; appliedEdits: AppliedEdit[] } | null {
  const analysis = analyzeIssueAnchor(workingText, issue, appliedEdits);
  if ((analysis.state !== 'safe-exact' && analysis.state !== 'safe-whitespace')
    || analysis.start === undefined
    || analysis.end === undefined) return null;

  const edit: AppliedEdit = {
    id: crypto.randomUUID(),
    issueId: issue.id,
    start: analysis.start,
    end: analysis.end,
    original: analysis.matchedText || issue.original,
    revised: issue.revised,
    appliedAt: new Date().toISOString(),
  };
  return {
    workingText: `${workingText.slice(0, analysis.start)}${issue.revised}${workingText.slice(analysis.end)}`,
    appliedEdits: [...appliedEdits, edit],
  };
}

export function applyIssueToWorkspace(state: WorkspaceState, issue: ReviewIssue): WorkspaceState {
  if (state.currentResult?.safetyGate?.status === 'quarantined') {
    throw new Error('AI 候选稿已被安全门隔离，不能应用到作者工作稿。');
  }

  const next = applyIssueWithoutHistory(state.workingText, state.appliedEdits, issue);
  if (!next) {
    throw new Error(analyzeIssueAnchor(state.workingText, issue, state.appliedEdits).message);
  }

  return {
    ...state,
    ...next,
    decisions: { ...state.decisions, [issue.id]: 'accepted' },
    undoStack: [...state.undoStack.slice(-24), frameFrom(state)],
    redoStack: [],
  };
}

export function removeAppliedIssueFromWorkspace(state: WorkspaceState, issueId: string): WorkspaceState {
  if (!state.appliedEdits.some((edit) => edit.issueId === issueId)) return state;
  const issues = new Map((state.currentResult?.issues || []).map((issue) => [issue.id, issue]));
  const retainedIssueIds = state.appliedEdits.map((edit) => edit.issueId).filter((id) => id !== issueId);
  let workingText = state.draft.sourceText;
  let appliedEdits: AppliedEdit[] = [];

  for (const retainedId of retainedIssueIds) {
    const issue = issues.get(retainedId);
    if (!issue) continue;
    const replayed = applyIssueWithoutHistory(workingText, appliedEdits, issue);
    if (!replayed) continue;
    workingText = replayed.workingText;
    appliedEdits = replayed.appliedEdits;
  }

  return {
    ...state,
    workingText,
    appliedEdits,
    undoStack: [...state.undoStack.slice(-24), frameFrom(state)],
    redoStack: [],
  };
}

export function undoWorkspace(state: WorkspaceState): WorkspaceState {
  const previous = state.undoStack.at(-1);
  if (!previous) return state;
  return {
    ...state,
    workingText: previous.workingText,
    appliedEdits: previous.appliedEdits,
    undoStack: state.undoStack.slice(0, -1),
    redoStack: [...state.redoStack.slice(-24), frameFrom(state)],
  };
}

export function redoWorkspace(state: WorkspaceState): WorkspaceState {
  const next = state.redoStack.at(-1);
  if (!next) return state;
  return {
    ...state,
    workingText: next.workingText,
    appliedEdits: next.appliedEdits,
    undoStack: [...state.undoStack.slice(-24), frameFrom(state)],
    redoStack: state.redoStack.slice(0, -1),
  };
}

export function replaceWorkingText(state: WorkspaceState, workingText: string): WorkspaceState {
  if (workingText === state.workingText) return state;
  return {
    ...state,
    workingText,
    undoStack: [...state.undoStack.slice(-24), frameFrom(state)],
    redoStack: [],
  };
}
