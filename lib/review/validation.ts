import {
  MAX_MODEL_OUTPUT_CHARACTERS,
  MAX_SOURCE_CHARACTERS,
  MAX_TERMINOLOGY_LOCKS,
  MIN_SOURCE_CHARACTERS,
} from '@/lib/config';
import { evaluateLocalRevision, evaluateSafetyGate } from '@/lib/review/safety-gate';
import type {
  AcademicStage,
  EnglishVariant,
  ExplanationLevel,
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
const ACADEMIC_STAGES = new Set<AcademicStage>(['masters', 'doctoral', 'postgraduate', 'researcher', 'other']);
const ENGLISH_VARIANTS = new Set<EnglishVariant>(['us', 'uk']);
const EXPLANATION_LEVELS = new Set<ExplanationLevel>(['brief', 'balanced', 'detailed']);

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
  };
}

export interface DeterministicCheckResult {
  passed: boolean;
  violations: string[];
}

export function runDeterministicChecks(request: ReviewRequest, outputText: string): DeterministicCheckResult {
  const report = evaluateSafetyGate(request, outputText);
  const violations = report.checks
    .filter((check) => check.state === 'blocked')
    .map((check) => check.summary);
  return { passed: report.status === 'passed', violations };
}

function parseIssue(
  value: unknown,
  index: number,
  sourceText: string,
  candidateQuarantined: boolean,
): ReviewIssue {
  if (!isRecord(value)) throw new ValidationError(`第 ${index + 1} 条问题不是有效对象。`, 'INVALID_MODEL_OUTPUT', 502);
  const severity = SEVERITIES.has(value.severity as IssueSeverity) ? value.severity as IssueSeverity : 'suggestion';
  const original = cleanText(value.original, 4_000);
  const revised = cleanText(value.revised, 4_000);
  const modelMeaningChanged = value.meaningChanged === true;
  const authorActionRequired = value.authorActionRequired === true;
  const occurrences = original ? sourceText.split(original).length - 1 : 0;
  const localViolations = original && revised ? evaluateLocalRevision(original, revised) : [];
  const meaningChanged = modelMeaningChanged || localViolations.some((violation) => (
    violation.includes('因果') || violation.includes('确定性') || violation.includes('普遍结论')
  ));

  let safeToApply = true;
  let safetyReason = '';
  if (candidateQuarantined) {
    safeToApply = false;
    safetyReason = '完整候选稿未通过科研事实安全门，本次建议默认隔离，需作者手动核对。';
  } else if (!original || !revised) {
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
  } else if (localViolations.length) {
    safeToApply = false;
    safetyReason = localViolations.join(' ');
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
  if (suggestedText.length > MAX_MODEL_OUTPUT_CHARACTERS) {
    throw new ValidationError('模型输出超过安全长度限制。', 'MODEL_OUTPUT_TOO_LARGE', 502);
  }

  const safetyGate = evaluateSafetyGate(request, suggestedText);
  const inputIssues = Array.isArray(raw.issues) ? raw.issues.slice(0, 120) : [];
  const issues = inputIssues.map((issue, index) => parseIssue(
    issue,
    index,
    request.text,
    safetyGate.status === 'quarantined',
  ));
  const seen = new Set<string>();
  for (const issue of issues) {
    if (seen.has(issue.id)) throw new ValidationError('模型返回了重复的问题 ID。', 'INVALID_MODEL_OUTPUT', 502);
    seen.add(issue.id);
  }

  const warnings = uniqueStrings(safetyGate.checks
    .filter((check) => check.state !== 'passed')
    .map((check) => check.summary));

  return {
    id: crypto.randomUUID(),
    taskId: request.taskId,
    summary: cleanText(raw.summary, 2_000) || '检查已完成，请逐条核对建议。',
    suggestedText,
    issues,
    warnings,
    safetyGate,
    generatedAt: new Date().toISOString(),
  };
}
