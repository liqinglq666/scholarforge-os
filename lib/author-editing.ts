import type { ReviewIssue } from '@/lib/types';

export const AUTHOR_EDITING_SESSION_KEY = 'scholarforge-os-author-editing-session-v1';

export type AnchorState =
  | 'safe-exact'
  | 'safe-whitespace'
  | 'applied'
  | 'ambiguous'
  | 'missing'
  | 'conflict'
  | 'manual';

export interface AppliedEdit {
  issueId: string;
  start: number;
  end: number;
  original: string;
  revised: string;
  appliedAt: string;
}

export interface AnchorAnalysis {
  state: AnchorState;
  start?: number;
  end?: number;
  matchedText?: string;
  message: string;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collectExactMatches(source: string, target: string) {
  const matches: Array<{ start: number; end: number; text: string }> = [];
  let cursor = 0;
  while (cursor <= source.length) {
    const start = source.indexOf(target, cursor);
    if (start < 0) break;
    matches.push({ start, end: start + target.length, text: source.slice(start, start + target.length) });
    cursor = start + Math.max(1, target.length);
  }
  return matches;
}

function collectWhitespaceMatches(source: string, target: string) {
  const tokens = target.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const pattern = tokens.map(escapeRegExp).join('\\s+');
  const regex = new RegExp(pattern, 'gu');
  return Array.from(source.matchAll(regex)).map((match) => ({
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
    text: match[0],
  }));
}

function containsAuthorPlaceholder(value: string) {
  return /\[(?:please\s+provide|author(?:\s+to)?\s+(?:provide|confirm|complete)|todo|to\s+be\s+(?:added|confirmed|completed)|待补|作者(?:补充|确认|填写))[^\]]*\]/i.test(value);
}

export function rangesOverlap(a: Pick<AppliedEdit, 'start' | 'end'>, b: Pick<AppliedEdit, 'start' | 'end'>) {
  return a.start < b.end && b.start < a.end;
}

export function analyseIssueAnchor(source: string, issue: ReviewIssue, applied: AppliedEdit[]): AnchorAnalysis {
  if (applied.some((edit) => edit.issueId === issue.id)) {
    return { state: 'applied', message: '该建议已经进入当前工作稿。' };
  }

  const original = issue.original?.trim() || '';
  const revised = issue.revised?.trim() || '';

  if (!original || !revised) {
    return { state: 'manual', message: '缺少可定位的原文或建议文本，需要作者手动处理。' };
  }
  if (original === revised) {
    return { state: 'manual', message: '建议文本与原文相同，不需要自动替换。' };
  }
  if (containsAuthorPlaceholder(revised)) {
    return { state: 'manual', message: '该建议包含作者待补信息，不能自动写入正文。' };
  }
  if (original.length < 4) {
    return { state: 'manual', message: '原文片段过短，自动替换存在误命中风险。' };
  }

  const exactMatches = collectExactMatches(source, original);
  let matches = exactMatches;
  let anchor: 'exact' | 'whitespace' = 'exact';

  if (!matches.length) {
    matches = collectWhitespaceMatches(source, original);
    anchor = 'whitespace';
  }

  if (!matches.length) {
    return { state: 'missing', message: '当前原稿中找不到该原文片段，可能已被作者修改。' };
  }
  if (matches.length > 1) {
    return { state: 'ambiguous', message: `原稿中出现 ${matches.length} 个相同片段，无法安全判断替换位置。` };
  }

  const match = matches[0];
  if (/\r|\n/.test(match.text)) {
    return { state: 'manual', message: '该建议跨越段落或换行，当前版本要求作者手动确认。' };
  }

  const candidate = { start: match.start, end: match.end };
  if (applied.some((edit) => rangesOverlap(candidate, edit))) {
    return { state: 'conflict', message: '该建议与已应用修改范围重叠，需要作者选择其中一个版本。' };
  }

  return {
    state: anchor === 'exact' ? 'safe-exact' : 'safe-whitespace',
    start: match.start,
    end: match.end,
    matchedText: match.text,
    message: anchor === 'exact'
      ? '原文唯一且精确匹配，可以安全应用。'
      : '原文在忽略空白差异后唯一匹配，可以安全应用。',
  };
}

export function createAppliedEdit(issue: ReviewIssue, analysis: AnchorAnalysis): AppliedEdit | null {
  if ((analysis.state !== 'safe-exact' && analysis.state !== 'safe-whitespace') || analysis.start === undefined || analysis.end === undefined) {
    return null;
  }
  return {
    issueId: issue.id,
    start: analysis.start,
    end: analysis.end,
    original: analysis.matchedText || issue.original,
    revised: issue.revised.trim(),
    appliedAt: new Date().toISOString(),
  };
}

export interface NormalizedAppliedEdits {
  valid: AppliedEdit[];
  droppedIssueIds: string[];
}

export function normalizeAppliedEdits(source: string, edits: AppliedEdit[]): NormalizedAppliedEdits {
  const valid: AppliedEdit[] = [];
  const droppedIssueIds: string[] = [];
  const seenIssueIds = new Set<string>();
  const candidates = Array.isArray(edits) ? [...edits].sort((a, b) => a.start - b.start) : [];

  for (const edit of candidates) {
    const issueId = typeof edit?.issueId === 'string' ? edit.issueId : '';
    const rangeValid = Number.isInteger(edit?.start)
      && Number.isInteger(edit?.end)
      && edit.start >= 0
      && edit.end > edit.start
      && edit.end <= source.length;
    const textValid = typeof edit?.original === 'string'
      && typeof edit?.revised === 'string'
      && edit.revised.trim().length > 0;
    const sourceMatches = rangeValid && textValid
      ? source.slice(edit.start, edit.end) === edit.original
      : false;
    const duplicate = !issueId || seenIssueIds.has(issueId);
    const overlaps = rangeValid && valid.some((current) => rangesOverlap(edit, current));

    if (!rangeValid || !textValid || !sourceMatches || duplicate || overlaps) {
      if (issueId) droppedIssueIds.push(issueId);
      continue;
    }

    seenIssueIds.add(issueId);
    valid.push({ ...edit });
  }

  return { valid, droppedIssueIds };
}

export function composeWorkingText(source: string, edits: AppliedEdit[]) {
  const ordered = normalizeAppliedEdits(source, edits).valid.sort((a, b) => b.start - a.start);
  let output = source;
  for (const edit of ordered) {
    output = `${output.slice(0, edit.start)}${edit.revised}${output.slice(edit.end)}`;
  }
  return output;
}
