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


# 1. Harden author-editing anchors and persisted edit ranges.
replace_once(
    'lib/author-editing.ts',
    """function collectWhitespaceMatches(source: string, target: string) {
  const tokens = target.trim().split(/\\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const pattern = tokens.map(escapeRegExp).join('\\\\s+');
  const regex = new RegExp(pattern, 'gu');
  return Array.from(source.matchAll(regex)).map((match) => ({
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
    text: match[0],
  }));
}
""",
    """function collectWhitespaceMatches(source: string, target: string) {
  const tokens = target.trim().split(/\\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const pattern = tokens.map(escapeRegExp).join('\\\\s+');
  const regex = new RegExp(pattern, 'gu');
  return Array.from(source.matchAll(regex)).map((match) => ({
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
    text: match[0],
  }));
}

function containsAuthorPlaceholder(value: string) {
  return /\\[(?:please\\s+provide|author(?:\\s+to)?\\s+(?:provide|confirm|complete)|todo|to\\s+be\\s+(?:added|confirmed|completed)|待补|作者(?:补充|确认|填写))[^\\]]*\\]/i.test(value);
}
""",
)
replace_once(
    'lib/author-editing.ts',
    """  if (/\\[Please provide[^\\]]*\\]/i.test(revised)) {
    return { state: 'manual', message: '该建议包含作者待补信息，不能自动写入正文。' };
  }
""",
    """  if (containsAuthorPlaceholder(revised)) {
    return { state: 'manual', message: '该建议包含作者待补信息，不能自动写入正文。' };
  }
""",
)
replace_once(
    'lib/author-editing.ts',
    """  if (match.text.includes('\\n\\n')) {
    return { state: 'manual', message: '该建议跨越多个段落，当前版本要求作者手动确认。' };
  }
""",
    """  if (/\\r|\\n/.test(match.text)) {
    return { state: 'manual', message: '该建议跨越段落或换行，当前版本要求作者手动确认。' };
  }
""",
)
replace_once(
    'lib/author-editing.ts',
    """export function composeWorkingText(source: string, edits: AppliedEdit[]) {
  const ordered = [...edits].sort((a, b) => b.start - a.start);
  let output = source;
  for (const edit of ordered) {
    output = `${output.slice(0, edit.start)}${edit.revised}${output.slice(edit.end)}`;
  }
  return output;
}
""",
    """export interface NormalizedAppliedEdits {
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
""",
)

# 2. Validate edits before DOCX generation and normalize line breaks.
replace_once(
    'lib/docx-export.ts',
    """import { composeWorkingText } from '@/lib/author-editing';
""",
    """import { composeWorkingText, normalizeAppliedEdits } from '@/lib/author-editing';
""",
)
replace_once(
    'lib/docx-export.ts',
    """function paragraphs(value: string) {
  return value.split(/\\n{2,}/).map((item) => item.trim()).filter(Boolean);
}
""",
    """function paragraphs(value: string) {
  return value
    .replace(/\\r\\n/g, '\\n')
    .split(/\\n{2,}/)
    .map((item) => item.replace(/\\n+/g, ' ').trim())
    .filter(Boolean);
}
""",
)
replace_once(
    'lib/docx-export.ts',
    """  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
  const workingText = composeWorkingText(options.sourceText, [...options.edits].sort((a, b) => a.start - b.start));
""",
    """  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
  const normalizedEdits = normalizeAppliedEdits(options.sourceText, options.edits).valid;
  const workingText = composeWorkingText(options.sourceText, normalizedEdits);
""",
)
replace_once(
    'lib/docx-export.ts',
    """        new Paragraph({ text: `Applied suggestions: ${options.edits.length}` }),
""",
    """        new Paragraph({ text: `Applied suggestions: ${normalizedEdits.length}` }),
""",
)

# 3. Avoid duplicated table/list text during DOCX extraction and reject empty files.
replace_once(
    'lib/document-ingestion.ts',
    """  const document = new DOMParser().parseFromString(htmlResult.value, 'text/html');
  const blocks: StructuredBlock[] = Array.from(document.body.querySelectorAll('h1,h2,h3,h4,p,li,td'))
    .map((node) => ({
      kind: /^H[1-4]$/.test(node.tagName) ? 'heading' as const : 'paragraph' as const,
      level: /^H[1-4]$/.test(node.tagName) ? Number(node.tagName.slice(1)) : undefined,
      text: cleanText(node.textContent || ''),
    }))
    .filter((block) => block.text);
""",
    """  const document = new DOMParser().parseFromString(htmlResult.value, 'text/html');
  const contentNodes = Array.from(document.body.querySelectorAll('h1,h2,h3,h4,p,li,td'))
    .filter((node) => !((node.tagName === 'TD' || node.tagName === 'LI') && node.querySelector('p,li')));
  const blocks: StructuredBlock[] = contentNodes
    .map((node) => ({
      kind: /^H[1-4]$/.test(node.tagName) ? 'heading' as const : 'paragraph' as const,
      level: /^H[1-4]$/.test(node.tagName) ? Number(node.tagName.slice(1)) : undefined,
      text: cleanText(node.textContent || ''),
    }))
    .filter((block) => block.text);
""",
)
replace_once(
    'lib/document-ingestion.ts',
    """export async function ingestResearchDocument(file: File): Promise<IngestedDocument> {
  if (file.size > DOCUMENT_MAX_BYTES) throw new Error('文件超过 20 MB，请压缩或拆分后再导入。');
""",
    """export async function ingestResearchDocument(file: File): Promise<IngestedDocument> {
  if (file.size === 0) throw new Error('文件为空，请重新选择有效的 DOCX 文件。');
  if (file.size > DOCUMENT_MAX_BYTES) throw new Error('文件超过 20 MB，请压缩或拆分后再导入。');
""",
)


print('Applied reliability fixes part 1.')
