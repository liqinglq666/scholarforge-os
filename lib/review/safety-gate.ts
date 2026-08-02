import type { ReviewRequest, SafetyCheck, SafetyGateReport } from '@/lib/types';
import { hasDangerousPlaceholder } from '@/lib/validation/common';

const NUMBER_PATTERN = /(?<![\p{L}\d])[-+]?\d+(?:[,.]\d+)*(?:[eE][-+]?\d+)?%?/gu;
const UNIT_PATTERN = /[-+]?\d+(?:[,.]\d+)*(?:[eE][-+]?\d+)?\s*(?:%|°C|K|Pa|kPa|MPa|GPa|Hz|kHz|MHz|g|kg|mg|μg|ug|m|cm|mm|μm|um|nm|L|mL|μL|uL|mol|mmol|s|min|h|d)\b/giu;
const DOI_PATTERN = /10\.\d{4,9}\/[-._;()/:A-Z0-9]+/gi;
const AUTHOR_YEAR_PATTERN = /\b[A-Z][A-Za-z'’-]+(?:\s+et\s+al\.)?,?\s*\(?\d{4}[a-z]?\)?/g;
const NEW_EXPERIMENT_PATTERNS = [
  /\b(?:we|the authors?)\s+(?:additionally|further|also|newly)\s+(?:conducted|performed|carried out|completed)\b/gi,
  /\b(?:additional|new|further)\s+experiments?\s+(?:were|was|have been)\s+(?:conducted|performed|carried out)\b/gi,
];
const ASSOCIATION_PATTERNS = [
  /\b(?:associate(?:d|s|ion)?|correlat(?:e|ed|es|ion)|relationship|linked|predict(?:ed|s|or)?)\b/gi,
  /(?:相关|关联|关系|预测)/g,
];
const CAUSAL_PATTERNS = [
  /\b(?:cause(?:d|s)?|causal|lead(?:s|ing)?\s+to|led\s+to|result(?:s|ed)?\s+in|determine(?:d|s)?|drive(?:s|n)?)\b/gi,
  /(?:导致|造成|决定了|引起|因果)/g,
];
const CAUTIOUS_PATTERNS = [
  /\b(?:may|might|could|can|suggest(?:s|ed)?|indicat(?:e|es|ed)|appear(?:s|ed)?|potential(?:ly)?|possible|likely)\b/gi,
  /(?:可能|提示|表明|或许|潜在|似乎)/g,
];
const CERTAIN_PATTERNS = [
  /\b(?:prove(?:s|d)?|demonstrate(?:s|d)?|confirm(?:s|ed)?|establish(?:es|ed)?|definitive(?:ly)?|certain(?:ly)?|always|never|completely|eliminate(?:d|s)?)\b/gi,
  /(?:证明|证实|确定|必然|始终|完全|彻底|消除)/g,
];
const LIMITED_SCOPE_PATTERNS = [
  /\b(?:sample|participants?|patients?|respondents?|subjects?|specimens?|three universities|single[- ]center|cross[- ]sectional)\b/gi,
  /(?:样本|参与者|患者|受试者|三所高校|单中心|横断面)/g,
];
const UNIVERSAL_SCOPE_PATTERNS = [
  /\b(?:all|every|entire|general population|nationwide|universally|in any context|without exception)\b/gi,
  /(?:所有|全部|全国|任何情况下|普遍适用|无一例外)/g,
];

function normalizeTokens(tokens: string[]) {
  return tokens.map((token) => token.replace(/\s+/g, '').replace(/,/g, '').toLocaleLowerCase()).sort();
}

function sameMultiset(left: string[], right: string[]) {
  return normalizeTokens(left).join('\u0000') === normalizeTokens(right).join('\u0000');
}

function matches(value: string, pattern: RegExp) {
  return value.match(pattern) || [];
}

function countPatterns(value: string, patterns: RegExp[]) {
  return patterns.reduce((total, pattern) => total + matches(value, pattern).length, 0);
}

function numberTokens(value: string) {
  return matches(value, NUMBER_PATTERN);
}

function unitTokens(value: string) {
  return matches(value, UNIT_PATTERN);
}

function citationTokens(value: string) {
  return [...matches(value, AUTHOR_YEAR_PATTERN), ...matches(value, DOI_PATTERN)];
}

function impliesNewExperiment(value: string) {
  return countPatterns(value, NEW_EXPERIMENT_PATTERNS) > 0;
}

function claimBoundaryViolations(source: string, candidate: string) {
  const violations: string[] = [];
  const sourceAssociation = countPatterns(source, ASSOCIATION_PATTERNS);
  const candidateAssociation = countPatterns(candidate, ASSOCIATION_PATTERNS);
  const sourceCausal = countPatterns(source, CAUSAL_PATTERNS);
  const candidateCausal = countPatterns(candidate, CAUSAL_PATTERNS);
  if (sourceAssociation > 0 && candidateCausal > sourceCausal && candidateAssociation < sourceAssociation) {
    violations.push('候选稿可能把相关、关联或预测关系升级为因果关系。');
  }

  const sourceCautious = countPatterns(source, CAUTIOUS_PATTERNS);
  const candidateCautious = countPatterns(candidate, CAUTIOUS_PATTERNS);
  const sourceCertain = countPatterns(source, CERTAIN_PATTERNS);
  const candidateCertain = countPatterns(candidate, CERTAIN_PATTERNS);
  if (sourceCautious > 0 && candidateCertain > sourceCertain && candidateCautious < sourceCautious) {
    violations.push('候选稿可能把审慎结论升级为确定性结论。');
  }

  const sourceLimited = countPatterns(source, LIMITED_SCOPE_PATTERNS);
  const sourceUniversal = countPatterns(source, UNIVERSAL_SCOPE_PATTERNS);
  const candidateUniversal = countPatterns(candidate, UNIVERSAL_SCOPE_PATTERNS);
  if (sourceLimited > 0 && candidateUniversal > sourceUniversal) {
    violations.push('候选稿可能把有限样本或特定研究场景扩大为普遍结论。');
  }
  return violations;
}

function createCheck(
  id: string,
  title: string,
  violations: string[],
  passedSummary: string,
  evidence: string[] = [],
): SafetyCheck {
  return violations.length
    ? { id, title, state: 'blocked', summary: violations.join(' '), evidence }
    : { id, title, state: 'passed', summary: passedSummary, evidence };
}

export function evaluateLocalRevision(original: string, revised: string) {
  const violations: string[] = [];
  if (!sameMultiset(numberTokens(original), numberTokens(revised))) {
    violations.push('局部建议改变了数值、百分数或科学计数法。');
  }
  if (!sameMultiset(unitTokens(original), unitTokens(revised))) {
    violations.push('局部建议改变了带单位数值。');
  }
  if (!sameMultiset(citationTokens(original), citationTokens(revised))) {
    violations.push('局部建议改变或新增了作者—年份引用或 DOI。');
  }
  if (!impliesNewExperiment(original) && impliesNewExperiment(revised)) {
    violations.push('局部建议声称进行了原文未提供的新增实验。');
  }
  if (hasDangerousPlaceholder(revised)) {
    violations.push('局部建议包含作者待补占位符。');
  }
  violations.push(...claimBoundaryViolations(original, revised));
  return violations;
}

export function evaluateSafetyGate(request: ReviewRequest, candidateText: string): SafetyGateReport {
  const checks: SafetyCheck[] = [];
  const trimmed = candidateText.trim();
  checks.push(createCheck(
    'candidate-text',
    '候选稿完整性',
    trimmed ? [] : ['模型没有返回可核对的完整候选稿。'],
    '候选稿存在且可以继续执行安全检查。',
  ));

  const sourceNumbers = numberTokens(request.text);
  const candidateNumbers = numberTokens(candidateText);
  checks.push(createCheck(
    'numbers',
    '数值与样本量',
    sameMultiset(sourceNumbers, candidateNumbers) ? [] : ['候选稿中的数值、样本量、百分数或科学计数法与原文不一致。'],
    `已核对 ${sourceNumbers.length} 个数值标记，未发现增删或改写。`,
    sourceNumbers.slice(0, 8),
  ));

  const sourceUnits = unitTokens(request.text);
  const candidateUnits = unitTokens(candidateText);
  checks.push(createCheck(
    'units',
    '数值与单位组合',
    sameMultiset(sourceUnits, candidateUnits) ? [] : ['候选稿中的带单位数值与原文不一致。'],
    `已核对 ${sourceUnits.length} 个带单位数值。`,
    sourceUnits.slice(0, 8),
  ));

  const sourceCitations = citationTokens(request.text);
  const candidateCitations = citationTokens(candidateText);
  checks.push(createCheck(
    'citations',
    '引用与 DOI',
    sameMultiset(sourceCitations, candidateCitations) ? [] : ['候选稿改变、新增或删除了作者—年份引用或 DOI。'],
    `已核对 ${sourceCitations.length} 个引用或 DOI 标记。`,
    sourceCitations.slice(0, 8),
  ));

  const terminologyViolations = request.terminologyLocks.flatMap((lock) => {
    if (!request.text.toLocaleLowerCase().includes(lock.source.toLocaleLowerCase())) return [];
    return candidateText.toLocaleLowerCase().includes(lock.preferred.toLocaleLowerCase())
      ? []
      : [`术语“${lock.source}”没有按规则使用“${lock.preferred}”。`];
  });
  checks.push(createCheck(
    'terminology',
    '术语规则',
    terminologyViolations,
    request.terminologyLocks.length ? `已核对 ${request.terminologyLocks.length} 条术语规则。` : '本次没有额外术语规则。',
  ));

  checks.push(createCheck(
    'experiments',
    '新增实验声明',
    !impliesNewExperiment(request.text) && impliesNewExperiment(candidateText)
      ? ['候选稿声称进行了原文未提供的新增实验。']
      : [],
    '未发现候选稿凭空新增实验或方法执行声明。',
  ));

  checks.push(createCheck(
    'placeholders',
    '未完成占位符',
    hasDangerousPlaceholder(candidateText) ? ['候选稿包含未完成占位符或待补内容。'] : [],
    '未发现 TODO、待补引用或虚构占位符。',
  ));

  const claimViolations = claimBoundaryViolations(request.text, candidateText);
  checks.push(createCheck(
    'claim-boundary',
    '因果、结论强度与研究范围',
    claimViolations,
    '未发现相关性被升级为因果、审慎结论被升级为确定结论，或有限样本被扩大为普遍结论。',
  ));

  const blockedCount = checks.filter((check) => check.state === 'blocked').length;
  const reviewCount = checks.filter((check) => check.state === 'review').length;
  return {
    status: blockedCount ? 'quarantined' : 'passed',
    checks,
    blockedCount,
    reviewCount,
    checkedAt: new Date().toISOString(),
  };
}
