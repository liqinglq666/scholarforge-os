import type {
  ConsistencyIssue,
  ConsistencyOccurrence,
  ManuscriptChapter,
  ManuscriptProject,
} from '@/lib/types';

const ABBREVIATION_IGNORE = new Set([
  'ANOVA', 'CI', 'DOI', 'DNA', 'RNA', 'SD', 'SE', 'SI', 'USA', 'UK',
  'MPA', 'KPA', 'GPA', 'PA', 'KG', 'MG', 'ML', 'MM', 'CM', 'NM', 'HZ',
]);

const METRIC_STOP_WORDS = new Set([
  'a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'the', 'to',
  'was', 'were', 'is', 'are', 'mean', 'average', 'value', 'values', 'approximately',
]);

function compact(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function excerpt(text: string, index: number, length: number) {
  const start = Math.max(0, index - 45);
  const end = Math.min(text.length, index + length + 70);
  return compact(`${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`);
}

function occurrence(chapter: ManuscriptChapter, text: string, index: number, length: number): ConsistencyOccurrence {
  return {
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    excerpt: excerpt(text, index, length),
  };
}

function uniqueOccurrences(items: ConsistencyOccurrence[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.chapterId}\u0000${item.excerpt}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mostlyEnglish(text: string) {
  const latin = text.match(/[A-Za-z]/g)?.length || 0;
  const chinese = text.match(/[\u3400-\u9fff]/g)?.length || 0;
  return latin > Math.max(40, chinese * 1.5);
}

function termIndex(text: string, term: string) {
  if (!term) return -1;
  return text.toLocaleLowerCase().indexOf(term.toLocaleLowerCase());
}

function metricKey(raw: string) {
  const words = raw
    .toLocaleLowerCase()
    .replace(/[^a-z\u3400-\u9fff-]+/g, ' ')
    .split(/\s+/)
    .filter((word) => word && !METRIC_STOP_WORDS.has(word));
  return words.slice(-3).join(' ');
}

interface ValueOccurrence {
  value: string;
  occurrence: ConsistencyOccurrence;
}

function addValue(map: Map<string, ValueOccurrence[]>, key: string, value: string, item: ConsistencyOccurrence) {
  if (!key) return;
  const current = map.get(key) || [];
  if (!current.some((entry) => entry.value === value && entry.occurrence.chapterId === item.chapterId && entry.occurrence.excerpt === item.excerpt)) {
    current.push({ value, occurrence: item });
    map.set(key, current);
  }
}

function sampleSizeIssues(chapters: ManuscriptChapter[]): ConsistencyIssue[] {
  const values = new Map<string, ValueOccurrence[]>();
  const patterns = [
    /\b[nN]\s*=\s*(\d{1,6})\b/g,
    /\b(\d{1,6})\s+(participants?|patients?|subjects?|respondents?|samples?|specimens?|observations?)\b/gi,
    /(\d{1,6})\s*(?:名|例|个|份)?\s*(?:受试者|患者|参与者|被试|样本|试件|观测对象)/g,
    /(?:样本量|总样本|纳入样本)[为共计约:\s]*(\d{1,6})/g,
  ];

  for (const chapter of chapters) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      for (const match of chapter.text.matchAll(pattern)) {
        const value = match[1];
        if (!value || match.index === undefined) continue;
        addValue(values, 'sample-size', value, occurrence(chapter, chapter.text, match.index, match[0].length));
      }
    }
  }

  const candidates = values.get('sample-size') || [];
  const distinct = new Set(candidates.map((item) => item.value));
  const chapterIds = new Set(candidates.map((item) => item.occurrence.chapterId));
  if (distinct.size < 2 || chapterIds.size < 2) return [];
  return [{
    id: 'consistency-sample-size',
    type: 'sample-size',
    severity: 'major',
    title: `检测到多个样本量候选值：${Array.from(distinct).join('、')}`,
    description: '这些数值可能分别代表总样本、分组样本或分析子集。系统不会判断哪个正确，请核对摘要、方法、结果和结论中的研究对象范围。',
    occurrences: uniqueOccurrences(candidates.map((item) => item.occurrence)),
  }];
}

function metricValueIssues(chapters: ManuscriptChapter[]): ConsistencyIssue[] {
  const values = new Map<string, ValueOccurrence[]>();
  const english = /\b([A-Za-z][A-Za-z-]*(?:\s+[A-Za-z][A-Za-z-]*){0,4})\s+(?:(?:was|were|is|are|reached|averaged|measured|remained|increased to|decreased to|of)\s+)?(\d+(?:\.\d+)?)\s*(MPa|kPa|GPa|Pa|mg\/L|g\/L|kg\/m(?:3|³)|°C|K|%|ms|min|h|days?|d)\b/gi;
  const chinese = /([\u3400-\u9fff]{2,16})(?:为|达到|约为|升至|降至|保持在)\s*(\d+(?:\.\d+)?)\s*(MPa|kPa|GPa|Pa|mg\/L|g\/L|kg\/m(?:3|³)|°C|K|%|毫秒|秒|分钟|小时|天)/g;

  for (const chapter of chapters) {
    for (const pattern of [english, chinese]) {
      pattern.lastIndex = 0;
      for (const match of chapter.text.matchAll(pattern)) {
        if (match.index === undefined) continue;
        const key = metricKey(match[1]);
        const value = match[2];
        const unit = match[3].toLocaleLowerCase();
        if (key.length < 3) continue;
        addValue(values, `${key}|${unit}`, value, occurrence(chapter, chapter.text, match.index, match[0].length));
      }
    }
  }

  const issues: ConsistencyIssue[] = [];
  for (const [key, candidates] of values) {
    const distinct = new Set(candidates.map((item) => item.value));
    const chapterIds = new Set(candidates.map((item) => item.occurrence.chapterId));
    if (distinct.size < 2 || chapterIds.size < 2) continue;
    const [label, unit] = key.split('|');
    issues.push({
      id: `consistency-metric-${issues.length + 1}`,
      type: 'metric-value',
      severity: 'minor',
      title: `“${label}”出现多个数值：${Array.from(distinct).map((value) => `${value} ${unit}`).join('、')}`,
      description: '这可能是不同时间点、分组或统计口径，也可能是不一致。请结合上下文核对，系统不会自动替换。',
      occurrences: uniqueOccurrences(candidates.map((item) => item.occurrence)),
    });
    if (issues.length >= 12) break;
  }
  return issues;
}

function abbreviationIssues(chapters: ManuscriptChapter[]): ConsistencyIssue[] {
  const definitions = new Map<string, Map<string, ConsistencyOccurrence[]>>();
  const usages = new Map<string, ConsistencyOccurrence[]>();
  const definitionPattern = /\b([A-Za-z][A-Za-z0-9-]*(?:\s+[A-Za-z][A-Za-z0-9-]*){1,8})\s*\(([A-Z][A-Z0-9-]{1,9})\)/g;
  const usePattern = /\b[A-Z][A-Z0-9-]{1,9}\b/g;

  for (const chapter of chapters) {
    definitionPattern.lastIndex = 0;
    for (const match of chapter.text.matchAll(definitionPattern)) {
      if (match.index === undefined) continue;
      const abbreviation = match[2];
      const longForm = compact(match[1]).toLocaleLowerCase();
      const byMeaning = definitions.get(abbreviation) || new Map<string, ConsistencyOccurrence[]>();
      byMeaning.set(longForm, [...(byMeaning.get(longForm) || []), occurrence(chapter, chapter.text, match.index, match[0].length)]);
      definitions.set(abbreviation, byMeaning);
    }

    usePattern.lastIndex = 0;
    for (const match of chapter.text.matchAll(usePattern)) {
      if (match.index === undefined || ABBREVIATION_IGNORE.has(match[0])) continue;
      usages.set(match[0], [...(usages.get(match[0]) || []), occurrence(chapter, chapter.text, match.index, match[0].length)]);
    }
  }

  const issues: ConsistencyIssue[] = [];
  for (const [abbreviation, meanings] of definitions) {
    if (meanings.size < 2) continue;
    issues.push({
      id: `consistency-abbreviation-conflict-${abbreviation}`,
      type: 'abbreviation',
      severity: 'major',
      title: `缩写 ${abbreviation} 对应多个定义`,
      description: `检测到：${Array.from(meanings.keys()).join('；')}。请确认是否为同一概念，或改用不同缩写。`,
      occurrences: uniqueOccurrences(Array.from(meanings.values()).flat()),
    });
  }

  for (const [abbreviation, items] of usages) {
    if (definitions.has(abbreviation)) continue;
    const unique = uniqueOccurrences(items);
    const chapterIds = new Set(unique.map((item) => item.chapterId));
    if (unique.length < 3 && chapterIds.size < 2) continue;
    issues.push({
      id: `consistency-abbreviation-undefined-${abbreviation}`,
      type: 'abbreviation',
      severity: 'suggestion',
      title: `缩写 ${abbreviation} 在项目中未找到定义`,
      description: '请确认它是否需要在首次出现时给出全称。常用单位和少量通用缩写已从检查中排除。',
      occurrences: unique.slice(0, 8),
    });
  }
  return issues.slice(0, 15);
}

function terminologyIssues(project: ManuscriptProject, chapters: ManuscriptChapter[]): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const bySource = new Map<string, Set<string>>();
  for (const lock of project.terminologyLocks) {
    const key = lock.source.toLocaleLowerCase();
    bySource.set(key, new Set([...(bySource.get(key) || []), lock.preferred.toLocaleLowerCase()]));
  }
  for (const [source, preferred] of bySource) {
    if (preferred.size < 2) continue;
    issues.push({
      id: `consistency-term-conflict-${issues.length + 1}`,
      type: 'terminology',
      severity: 'major',
      title: `术语“${source}”配置了多个指定表达`,
      description: `当前指定表达：${Array.from(preferred).join('、')}。请在项目术语库中保留一个明确版本。`,
      occurrences: [],
    });
  }

  for (const lock of project.terminologyLocks) {
    if (lock.source.toLocaleLowerCase() === lock.preferred.toLocaleLowerCase()) continue;
    const occurrences: ConsistencyOccurrence[] = [];
    for (const chapter of chapters) {
      if (!mostlyEnglish(chapter.text)) continue;
      const index = termIndex(chapter.text, lock.source);
      if (index < 0) continue;
      occurrences.push(occurrence(chapter, chapter.text, index, lock.source.length));
    }
    if (!occurrences.length) continue;
    issues.push({
      id: `consistency-term-${lock.id}`,
      type: 'terminology',
      severity: 'minor',
      title: `英文章节仍出现非指定表达“${lock.source}”`,
      description: `项目术语库指定使用“${lock.preferred}”。请逐处核对；系统不会自动替换。`,
      occurrences: uniqueOccurrences(occurrences),
    });
  }
  return issues;
}

export function analyzeProjectConsistency(project: ManuscriptProject): ConsistencyIssue[] {
  const chapters = project.chapters.filter((chapter) => chapter.text.trim().length >= 20);
  if (!chapters.length) return [];
  return [
    ...sampleSizeIssues(chapters),
    ...metricValueIssues(chapters),
    ...abbreviationIssues(chapters),
    ...terminologyIssues(project, chapters),
  ].slice(0, 40);
}
