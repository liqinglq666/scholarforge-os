import {
  MAX_MODEL_OUTPUT_CHARACTERS,
  MAX_SOURCE_CHARACTERS,
  MAX_TERMINOLOGY_LOCKS,
  MIN_SOURCE_CHARACTERS,
} from '@/lib/config';
import type {
  IssueSeverity,
  ReviewIssue,
  ReviewRequest,
  ReviewResult,
  SectionType,
  TaskType,
  TerminologyLock,
} from '@/lib/types';
import { cleanSingleLine, cleanText, hasDangerousPlaceholder, isRecord, uniqueStrings } from '@/lib/validation/common';

const TASKS = new Set<TaskType>(['translate', 'polish', 'precheck']);
const SECTIONS = new Set<SectionType>(['general', 'abstract', 'introduction', 'methods', 'results', 'discussion', 'conclusion']);
const SEVERITIES = new Set<IssueSeverity>(['major', 'minor', 'suggestion']);

export class ValidationError extends Error {
  constructor(message: string, public readonly code: string, public readonly status = 400) {
    super(message);
  }
}

export function sanitizeTerminologyLocks(value: unknown): TerminologyLock[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_TERMINOLOGY_LOCKS).flatMap((item, index) => {
    if (!isRecord(item)) return [];
    const source = cleanSingleLine(item.source, 120);
    const preferred = cleanSingleLine(item.preferred, 160);
    const note = cleanSingleLine(item.note, 240);
    if (!source || !preferred) return [];
    return [{
      id: cleanSingleLine(item.id, 80) || `term-${index + 1}`,
      source,
      preferred,
      ...(note ? { note } : {}),
    }];
  });
}

export function parseReviewRequest(value: unknown): ReviewRequest {
  if (!isRecord(value)) throw new ValidationError('请求正文必须是 JSON 对象。', 'INVALID_BODY');
  if (!TASKS.has(value.taskType as TaskType)) throw new ValidationError('请选择受支持的任务类型。', 'INVALID_TASK');
  if (!SECTIONS.has(value.sectionType as SectionType)) throw new ValidationError('请选择受支持的章节类型。', 'INVALID_SECTION');

  const text = cleanText(value.text, MAX_SOURCE_CHARACTERS + 1);
  if (text.length < MIN_SOURCE_CHARACTERS) {
    throw new ValidationError(`正文至少需要 ${MIN_SOURCE_CHARACTERS} 个字符。`, 'TEXT_TOO_SHORT');
  }
  if (text.length > MAX_SOURCE_CHARACTERS) {
    throw new ValidationError(`正文不能超过 ${MAX_SOURCE_CHARACTERS.toLocaleString()} 个字符。`, 'TEXT_TOO_LONG');
  }

  return {
    taskId: cleanSingleLine(value.taskId, 80) || crypto.randomUUID(),
    projectName: cleanSingleLine(value.projectName, 120) || '未命名任务',
    taskType: value.taskType as TaskType,
    sectionType: value.sectionType as SectionType,
    targetJournal: cleanSingleLine(value.targetJournal, 160),
    text,
    terminologyLocks: sanitizeTerminologyLocks(value.terminologyLocks),
  };
}

function numberTokens(value: string) {
  return value.match(/(?<![\p{L}\d])[-+]?\d+(?:[,.]\d+)*(?:[eE][-+]?\d+)?%?/gu)?.map((token) => token.replace(/,/g, '')) || [];
}

function unitTokens(value: string) {
  const units = '(?:%|°C|K|Pa|kPa|MPa|GPa|Hz|kHz|MHz|g|kg|mg|μg|ug|m|cm|mm|μm|um|nm|L|mL|μL|uL|mol|mmol|s|min|h|d)';
  return value.match(new RegExp(`[-+]?\\d+(?:[,.]\\d+)*(?:[eE][-+]?\\d+)?\\s*${units}`, 'giu'))
    ?.map((token) => token.replace(/\s+/g, '').replace(/,/g, '').toLowerCase()) || [];
}

function citationTokens(value: string) {
  const authorYear = value.match(/\b[A-Z][A-Za-z'’-]+(?:\s+et\s+al\.)?,?\s*\(?\d{4}[a-z]?\)?/g) || [];
  const dois = value.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/gi) || [];
  return [...authorYear, ...dois].map((token) => token.toLowerCase());
}

function impliesNewExperiment(value: string) {
  return /\b(?:we|the authors?)\s+(?:additionally|further|also|newly)\s+(?:conducted|performed|carried out|completed)\b/i.test(value)
    || /\b(?:additional|new|further)\s+experiments?\s+(?:were|was|have been)\s+(?:conducted|performed|carried out)\b/i.test(value);
}

function sameMultiset(a: string[], b: string[]) {
  return [...a].sort().join('\u0000') === [...b].sort().join('\u0000');
}

export interface DeterministicCheckResult {
  passed: boolean;
  violations: string[];
}

export function runDeterministicChecks(request: ReviewRequest, outputText: string): DeterministicCheckResult {
  const violations: string[] = [];
  if (!outputText.trim()) violations.push('模型没有返回建议稿。');
  if (outputText.length > MAX_MODEL_OUTPUT_CHARACTERS) violations.push('模型输出超过安全长度限制。');
  if (!sameMultiset(numberTokens(request.text), numberTokens(outputText))) violations.push('建议稿中的数值、科学计数法或百分数与原文不一致。');
  if (!sameMultiset(unitTokens(request.text), unitTokens(outputText))) violations.push('建议稿中的带单位数值与原文不一致。');

  for (const lock of request.terminologyLocks) {
    if (request.text.includes(lock.source) && !outputText.toLocaleLowerCase().includes(lock.preferred.toLocaleLowerCase())) {
      violations.push(`术语锁未满足：“${lock.source}”应使用“${lock.preferred}”。`);
    }
  }

  const sourceDois = new Set(request.text.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/gi) || []);
  const outputDois = outputText.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/gi) || [];
  if (outputDois.some((doi) => !sourceDois.has(doi))) violations.push('建议稿包含原文未提供的 DOI。');
  if (!sameMultiset(citationTokens(request.text), citationTokens(outputText))) violations.push('建议稿中的作者—年份引用或 DOI 与原文不一致。');
  if (!impliesNewExperiment(request.text) && impliesNewExperiment(outputText)) violations.push('建议稿声称进行了原文未提供的新增实验。');
  if (hasDangerousPlaceholder(outputText)) violations.push('建议稿包含未完成占位符。');

  return { passed: violations.length === 0, violations: uniqueStrings(violations) };
}

function parseIssue(value: unknown, index: number, sourceText: string): ReviewIssue {
  if (!isRecord(value)) throw new ValidationError(`第 ${index + 1} 条问题不是有效对象。`, 'INVALID_MODEL_OUTPUT', 502);
  const severity = SEVERITIES.has(value.severity as IssueSeverity) ? value.severity as IssueSeverity : 'suggestion';
  const original = cleanText(value.original, 4_000);
  const revised = cleanText(value.revised, 4_000);
  const meaningChanged = value.meaningChanged === true;
  const authorActionRequired = value.authorActionRequired === true;
  const occurrences = original ? sourceText.split(original).length - 1 : 0;

  let safeToApply = value.safeToApply === true;
  let safetyReason = cleanSingleLine(value.safetyReason, 320);
  if (!original || !revised) {
    safeToApply = false;
    safetyReason = '缺少可定位的原文或建议文本。';
  } else if (meaningChanged || authorActionRequired) {
    safeToApply = false;
    safetyReason = '可能改变科学含义或需要作者补充信息。';
  } else if (hasDangerousPlaceholder(revised)) {
    safeToApply = false;
    safetyReason = '建议包含作者待补占位符。';
  } else if (original.includes('\n\n') || revised.includes('\n\n')) {
    safeToApply = false;
    safetyReason = '建议跨越段落。';
  } else if (!sameMultiset(numberTokens(original), numberTokens(revised)) || !sameMultiset(unitTokens(original), unitTokens(revised))) {
    safeToApply = false;
    safetyReason = '局部建议改变了数值、百分数、科学计数法或带单位数值。';
  } else if (!sameMultiset(citationTokens(original), citationTokens(revised))) {
    safeToApply = false;
    safetyReason = '局部建议改变或新增了引用。';
  } else if (!impliesNewExperiment(original) && impliesNewExperiment(revised)) {
    safeToApply = false;
    safetyReason = '局部建议声称进行了原文未提供的新增实验。';
  } else if (occurrences !== 1) {
    safeToApply = false;
    safetyReason = occurrences === 0 ? '原文无法定位。' : '原文出现多次，无法唯一定位。';
  }

  return {
    id: cleanSingleLine(value.id, 80) || `issue-${index + 1}`,
    category: cleanSingleLine(value.category, 120) || 'General',
    severity,
    location: cleanSingleLine(value.location, 240) || '位置未说明',
    original,
    revised,
    reason: cleanText(value.reason, 1_500) || '模型未提供修改原因。',
    meaningChanged,
    authorActionRequired,
    safeToApply,
    ...(safetyReason ? { safetyReason } : {}),
  };
}

export function normalizeModelResult(raw: unknown, request: ReviewRequest): ReviewResult {
  if (!isRecord(raw)) throw new ValidationError('模型返回的不是 JSON 对象。', 'INVALID_MODEL_OUTPUT', 502);
  const suggestedText = cleanText(raw.suggestedText, MAX_MODEL_OUTPUT_CHARACTERS + 1);
  const checks = runDeterministicChecks(request, suggestedText);
  if (!checks.passed) {
    throw new ValidationError(checks.violations.join(' '), 'SAFETY_CHECK_FAILED', 422);
  }

  const inputIssues = Array.isArray(raw.issues) ? raw.issues.slice(0, 120) : [];
  const issues = inputIssues.map((issue, index) => parseIssue(issue, index, request.text));
  const seen = new Set<string>();
  for (const issue of issues) {
    if (seen.has(issue.id)) throw new ValidationError('模型返回了重复的问题 ID。', 'INVALID_MODEL_OUTPUT', 502);
    seen.add(issue.id);
  }

  return {
    id: crypto.randomUUID(),
    taskId: request.taskId,
    summary: cleanText(raw.summary, 2_000) || '检查已完成，请逐条核对建议。',
    suggestedText,
    issues,
    warnings: [],
    generatedAt: new Date().toISOString(),
  };
}
