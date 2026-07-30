import JSZip from 'jszip';
import type { AppliedEdit } from '@/lib/author-editing';
import type { StoredOriginalDocx } from '@/lib/original-docx-store';

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';
const MATH_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/math';

export interface OriginalDocxSkippedEdit {
  issueId: string;
  reason: string;
}

export interface OriginalDocxPatchReport {
  patchedIssueIds: string[];
  skipped: OriginalDocxSkippedEdit[];
  preservedEntries: number;
  sourceFileName: string;
}

export interface OriginalDocxPatchResult {
  blob: Blob;
  fileName: string;
  report: OriginalDocxPatchReport;
}

type ParagraphMatch = {
  paragraph: Element;
  paragraphIndex: number;
  start: number;
  end: number;
  anchor: 'exact' | 'whitespace';
  edit: AppliedEdit;
};

type RunRecord = {
  element: Element;
  text: string;
  start: number;
  end: number;
  properties: Element | null;
};

function localName(node: Node) {
  return node.localName || node.nodeName.split(':').pop() || node.nodeName;
}

function elementChildren(node: Node) {
  return Array.from(node.childNodes).filter((child): child is Element => child.nodeType === Node.ELEMENT_NODE);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collectMatches(source: string, target: string) {
  const exact: Array<{ start: number; end: number; anchor: 'exact' }> = [];
  let cursor = 0;
  while (cursor <= source.length) {
    const start = source.indexOf(target, cursor);
    if (start < 0) break;
    exact.push({ start, end: start + target.length, anchor: 'exact' });
    cursor = start + Math.max(1, target.length);
  }
  if (exact.length) return exact;
  const tokens = target.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const regex = new RegExp(tokens.map(escapeRegExp).join('\\s+'), 'gu');
  return Array.from(source.matchAll(regex)).map((match) => ({
    start: match.index || 0,
    end: (match.index || 0) + match[0].length,
    anchor: 'whitespace' as const,
  }));
}

function hasAncestor(element: Element, name: string) {
  let current: Element | null = element.parentElement;
  while (current) {
    if (localName(current) === name) return true;
    current = current.parentElement;
  }
  return false;
}

function paragraphComplexityReason(paragraph: Element) {
  if (hasAncestor(paragraph, 'tc')) return '建议位于表格单元格中，原文件补丁暂不自动修改表格。';
  const forbiddenNames = new Set([
    'hyperlink', 'fldChar', 'instrText', 'drawing', 'object', 'pict', 'smartTag',
    'bookmarkStart', 'bookmarkEnd', 'commentRangeStart', 'commentRangeEnd',
    'commentReference', 'footnoteReference', 'endnoteReference', 'ins', 'del',
  ]);
  for (const element of Array.from(paragraph.getElementsByTagName('*'))) {
    if (forbiddenNames.has(localName(element))) return '所在段落包含域、链接、批注、图形或已有修订，已保留给作者手动处理。';
    if (element.namespaceURI === MATH_NS || localName(element) === 'oMath' || localName(element) === 'oMathPara') {
      return '所在段落包含 Word 公式，原文件补丁不会自动重写公式段落。';
    }
  }
  const directChildren = elementChildren(paragraph);
  if (directChildren.some((child) => !['pPr', 'r', 'proofErr'].includes(localName(child)))) {
    return '所在段落包含复杂内联结构，无法在不破坏原格式的情况下安全重建。';
  }
  const runs = directChildren.filter((child) => localName(child) === 'r');
  if (!runs.length) return '所在段落没有可编辑的普通文本运行。';
  for (const run of runs) {
    const children = elementChildren(run);
    if (children.some((child) => !['rPr', 't'].includes(localName(child)))) {
      return '所在段落包含制表符、换行或特殊 Word 运行，已跳过自动补丁。';
    }
  }
  return '';
}

function runText(run: Element) {
  return Array.from(run.getElementsByTagNameNS(WORD_NS, 't')).map((node) => node.textContent || '').join('');
}

function paragraphRuns(paragraph: Element) {
  const records: RunRecord[] = [];
  let cursor = 0;
  for (const child of elementChildren(paragraph)) {
    if (localName(child) !== 'r') continue;
    const text = runText(child);
    const properties = elementChildren(child).find((node) => localName(node) === 'rPr') || null;
    records.push({ element: child, text, start: cursor, end: cursor + text.length, properties });
    cursor += text.length;
  }
  return records;
}

function paragraphText(paragraph: Element) {
  return paragraphRuns(paragraph).map((record) => record.text).join('');
}

function createTextRun(document: XMLDocument, text: string, properties: Element | null, deleted = false) {
  const run = document.createElementNS(WORD_NS, 'w:r');
  if (properties) run.appendChild(properties.cloneNode(true));
  const textNode = document.createElementNS(WORD_NS, deleted ? 'w:delText' : 'w:t');
  if (/^\s|\s$/.test(text)) textNode.setAttributeNS(XML_NS, 'xml:space', 'preserve');
  textNode.textContent = text;
  run.appendChild(textNode);
  return run;
}

function appendUnchangedRange(document: XMLDocument, fragment: DocumentFragment, records: RunRecord[], start: number, end: number) {
  if (end <= start) return;
  for (const record of records) {
    const pieceStart = Math.max(start, record.start);
    const pieceEnd = Math.min(end, record.end);
    if (pieceEnd <= pieceStart) continue;
    const text = record.text.slice(pieceStart - record.start, pieceEnd - record.start);
    if (text) fragment.appendChild(createTextRun(document, text, record.properties));
  }
}

function revisionWrapper(
  document: XMLDocument,
  kind: 'ins' | 'del',
  id: number,
  text: string,
  properties: Element | null,
  author: string,
  date: string,
) {
  const wrapper = document.createElementNS(WORD_NS, `w:${kind}`);
  wrapper.setAttributeNS(WORD_NS, 'w:id', String(id));
  wrapper.setAttributeNS(WORD_NS, 'w:author', author);
  wrapper.setAttributeNS(WORD_NS, 'w:date', date);
  wrapper.appendChild(createTextRun(document, text, properties, kind === 'del'));
  return wrapper;
}

function rebuildParagraph(document: XMLDocument, paragraph: Element, matches: ParagraphMatch[], nextRevisionId: () => number) {
  const records = paragraphRuns(paragraph);
  const text = records.map((record) => record.text).join('');
  const ordered = [...matches].sort((a, b) => a.start - b.start);
  const fragment = document.createDocumentFragment();
  const author = 'ScholarForge OS / Author';
  const date = new Date().toISOString();
  let cursor = 0;

  for (const match of ordered) {
    appendUnchangedRange(document, fragment, records, cursor, match.start);
    const styleRecord = records.find((record) => record.start < match.end && match.start < record.end) || records[0];
    const deletedText = text.slice(match.start, match.end);
    fragment.appendChild(revisionWrapper(document, 'del', nextRevisionId(), deletedText, styleRecord?.properties || null, author, date));
    fragment.appendChild(revisionWrapper(document, 'ins', nextRevisionId(), match.edit.revised, styleRecord?.properties || null, author, date));
    cursor = match.end;
  }
  appendUnchangedRange(document, fragment, records, cursor, text.length);

  for (const child of Array.from(paragraph.childNodes)) {
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const name = localName(child);
    if (name === 'r' || name === 'proofErr') paragraph.removeChild(child);
  }
  paragraph.appendChild(fragment);
}

function ensureTrackRevisions(settingsXml: string) {
  const parser = new DOMParser();
  const document = parser.parseFromString(settingsXml, 'application/xml');
  if (document.getElementsByTagName('parsererror').length) return settingsXml;
  const root = document.documentElement;
  if (!root.getElementsByTagNameNS(WORD_NS, 'trackRevisions').length) {
    root.appendChild(document.createElementNS(WORD_NS, 'w:trackRevisions'));
  }
  return new XMLSerializer().serializeToString(document);
}

function safeFileStem(value: string) {
  return value.replace(/\.docx$/i, '').replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 100) || 'scholarforge-original';
}

function maxExistingRevisionId(document: XMLDocument) {
  let maximum = 0;
  for (const name of ['ins', 'del']) {
    for (const node of Array.from(document.getElementsByTagNameNS(WORD_NS, name))) {
      const value = node.getAttributeNS(WORD_NS, 'id') || node.getAttribute('w:id') || '0';
      maximum = Math.max(maximum, Number.parseInt(value, 10) || 0);
    }
  }
  return maximum;
}

export async function patchOriginalDocx(
  original: StoredOriginalDocx,
  edits: AppliedEdit[],
): Promise<OriginalDocxPatchResult> {
  if (!edits.length) throw new Error('当前没有已应用修改，无法生成原文件补丁。');
  const zip = await JSZip.loadAsync(original.bytes);
  const documentEntry = zip.file('word/document.xml');
  if (!documentEntry) throw new Error('原 DOCX 缺少 word/document.xml，无法生成补丁。');

  const documentXml = await documentEntry.async('string');
  const parser = new DOMParser();
  const document = parser.parseFromString(documentXml, 'application/xml');
  if (document.getElementsByTagName('parsererror').length) throw new Error('无法解析原 DOCX 的正文 XML。');

  const paragraphs = Array.from(document.getElementsByTagNameNS(WORD_NS, 'p'));
  const paragraphTexts = paragraphs.map((paragraph) => paragraphText(paragraph));
  const mapped: ParagraphMatch[] = [];
  const skipped: OriginalDocxSkippedEdit[] = [];

  for (const edit of edits) {
    const target = edit.original.trim();
    if (!target || target.includes('\n')) {
      skipped.push({ issueId: edit.issueId, reason: '原文跨段或为空，不能写回原 DOCX。' });
      continue;
    }
    const candidates: ParagraphMatch[] = [];
    paragraphTexts.forEach((text, paragraphIndex) => {
      collectMatches(text, target).forEach((match) => candidates.push({
        paragraph: paragraphs[paragraphIndex],
        paragraphIndex,
        start: match.start,
        end: match.end,
        anchor: match.anchor,
        edit,
      }));
    });
    if (!candidates.length) {
      skipped.push({ issueId: edit.issueId, reason: '在原 DOCX 中找不到唯一原文，可能存在提取差异或作者已修改。' });
      continue;
    }
    if (candidates.length > 1) {
      skipped.push({ issueId: edit.issueId, reason: `原 DOCX 中出现 ${candidates.length} 个相同片段，无法安全选择位置。` });
      continue;
    }
    const candidate = candidates[0];
    const complexity = paragraphComplexityReason(candidate.paragraph);
    if (complexity) {
      skipped.push({ issueId: edit.issueId, reason: complexity });
      continue;
    }
    const overlap = mapped.some((existing) => existing.paragraphIndex === candidate.paragraphIndex && existing.start < candidate.end && candidate.start < existing.end);
    if (overlap) {
      skipped.push({ issueId: edit.issueId, reason: '该建议与同一原段落中的另一条修改范围重叠。' });
      continue;
    }
    mapped.push(candidate);
  }

  if (!mapped.length) {
    throw new Error(skipped[0]?.reason || '没有能够安全写回原 DOCX 的修改。');
  }

  let revisionId = maxExistingRevisionId(document) + 1;
  const nextRevisionId = () => revisionId++;
  const groups = new Map<number, ParagraphMatch[]>();
  mapped.forEach((match) => groups.set(match.paragraphIndex, [...(groups.get(match.paragraphIndex) || []), match]));
  for (const [paragraphIndex, matches] of groups) rebuildParagraph(document, paragraphs[paragraphIndex], matches, nextRevisionId);

  zip.file('word/document.xml', new XMLSerializer().serializeToString(document));
  const settingsEntry = zip.file('word/settings.xml');
  if (settingsEntry) zip.file('word/settings.xml', ensureTrackRevisions(await settingsEntry.async('string')));

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: original.mimeType,
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  return {
    blob,
    fileName: `${safeFileStem(original.fileName)}-scholarforge-tracked.docx`,
    report: {
      patchedIssueIds: mapped.map((match) => match.edit.issueId),
      skipped,
      preservedEntries: Object.keys(zip.files).length,
      sourceFileName: original.fileName,
    },
  };
}
