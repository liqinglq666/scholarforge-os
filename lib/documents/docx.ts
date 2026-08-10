import { MAX_DOCX_BYTES, MAX_SOURCE_CHARACTERS } from '@/lib/config';
import { inspectDocxArchive } from '@/lib/documents/docx-archive';
import type { SectionType, TaskType } from '@/lib/types';

export interface DocumentSection {
  id: string;
  title: string;
  sectionType: SectionType;
  text: string;
  characterCount: number;
}

export interface DocxImportResult {
  fileName: string;
  title: string;
  fullText: string;
  sections: DocumentSection[];
  warnings: string[];
  suggestedTask: TaskType;
}

interface TruncatedText {
  text: string;
  sourceCharacterCount: number;
  truncated: boolean;
}

const FULL_TEXT_PREVIEW_LIMIT = MAX_SOURCE_CHARACTERS * 20;
const SECTION_PREVIEW_LIMIT = MAX_SOURCE_CHARACTERS * 4;

const SECTION_PATTERNS: Array<{ sectionType: SectionType; label: string; pattern: RegExp }> = [
  { sectionType: 'abstract', label: 'Abstract', pattern: /^(abstract|摘要|摘\s*要)$/i },
  { sectionType: 'introduction', label: 'Introduction', pattern: /^(introduction|background|引言|绪论|研究背景)$/i },
  { sectionType: 'methods', label: 'Methods', pattern: /^(materials?\s*(?:and|&)\s*methods?|methods?|methodology|experimental\s*(?:program|procedure)|试验方法|实验方法|材料与方法|研究方法)$/i },
  { sectionType: 'results', label: 'Results', pattern: /^(results?|experimental\s+results?|试验结果|实验结果|结果)$/i },
  { sectionType: 'discussion', label: 'Discussion', pattern: /^(discussion|results?\s*(?:and|&)\s*discussion|讨论|结果与讨论)$/i },
  { sectionType: 'conclusion', label: 'Conclusion', pattern: /^(conclusions?|summary\s*(?:and|&)\s*conclusions?|结论|结语|总结与展望)$/i },
];

function normalizeHeading(value: string) {
  return value
    .replace(/^\s*(?:chapter\s+)?\d+(?:\.\d+)*[.)、]?\s*/i, '')
    .replace(/^第[一二三四五六七八九十百0-9]+章\s*/, '')
    .replace(/[:：.]\s*$/, '')
    .trim();
}

export function inferSectionType(title: string): SectionType {
  const normalized = normalizeHeading(title);
  return SECTION_PATTERNS.find((item) => item.pattern.test(normalized))?.sectionType || 'general';
}

function inferTask(text: string): TaskType {
  const chinese = text.match(/[\u3400-\u9fff]/g)?.length || 0;
  const latin = text.match(/[A-Za-z]/g)?.length || 0;
  return chinese > Math.max(30, latin * 0.28) ? 'translate' : 'precheck';
}

export function truncateImportedText(value: unknown, maxLength: number): TruncatedText {
  if (typeof value !== 'string') return { text: '', sourceCharacterCount: 0, truncated: false };
  const normalized = value.replace(/\r\n?/g, '\n').replace(/\u0000/g, '').trim();
  return {
    text: normalized.slice(0, maxLength),
    sourceCharacterCount: normalized.length,
    truncated: normalized.length > maxLength,
  };
}

function sectionsFromHtml(document: Document, fallbackTitle: string) {
  const sections: DocumentSection[] = [];
  let title = fallbackTitle;
  let sectionType: SectionType = 'general';
  let paragraphs: string[] = [];
  let sectionWasTruncated = false;
  let truncatedSectionCount = 0;

  const flush = () => {
    const preview = truncateImportedText(paragraphs.join('\n\n'), SECTION_PREVIEW_LIMIT);
    paragraphs = [];
    const truncated = sectionWasTruncated || preview.truncated;
    sectionWasTruncated = false;
    if (preview.text.length < 20) return;
    if (truncated) truncatedSectionCount += 1;
    const detected = SECTION_PATTERNS.find((item) => item.sectionType === sectionType);
    sections.push({
      id: `section-${sections.length + 1}`,
      title: detected?.label || title || fallbackTitle,
      sectionType,
      text: preview.text,
      characterCount: preview.text.length,
    });
  };

  for (const node of Array.from(document.body.querySelectorAll('h1,h2,h3,p,li'))) {
    const preview = truncateImportedText(node.textContent, SECTION_PREVIEW_LIMIT);
    if (!preview.text) continue;
    if (/^H[1-3]$/.test(node.tagName)) {
      flush();
      title = normalizeHeading(preview.text) || preview.text;
      sectionType = inferSectionType(preview.text);
    } else {
      paragraphs.push(preview.text);
      if (preview.truncated) sectionWasTruncated = true;
    }
  }
  flush();
  return { sections, truncatedSectionCount };
}

export function validateDocxFile(file: File) {
  if (!/\.docx$/i.test(file.name) && file.type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    throw new Error('仅支持 .docx 文件。PDF、旧版 .doc 和扫描图片不在当前可靠范围内。');
  }
  if (file.size > MAX_DOCX_BYTES) throw new Error('DOCX 文件不能超过 8 MB。');
  if (file.size === 0) throw new Error('DOCX 文件为空。');
}

export async function extractDocx(file: File): Promise<DocxImportResult> {
  validateDocxFile(file);
  const arrayBuffer = await file.arrayBuffer();
  inspectDocxArchive(arrayBuffer);
  const mammoth = await import('mammoth');

  const fullTextPreview = await mammoth.extractRawText({ arrayBuffer })
    .then((raw) => truncateImportedText(raw.value, FULL_TEXT_PREVIEW_LIMIT));
  if (!fullTextPreview.text) throw new Error('DOCX 中没有提取到可用正文。');

  const html = await mammoth.convertToHtml({ arrayBuffer }, {
    styleMap: [
      "p[style-name='Title'] => h1:fresh",
      "p[style-name='Heading 1'] => h1:fresh",
      "p[style-name='Heading 2'] => h2:fresh",
      "p[style-name='Heading 3'] => h3:fresh",
    ],
  });

  const document = new DOMParser().parseFromString(html.value, 'text/html');
  const title = file.name.replace(/\.docx$/i, '');
  const sectionResult = sectionsFromHtml(document, title);
  const safeSections = sectionResult.sections.length ? sectionResult.sections : [{
    id: 'section-1',
    title,
    sectionType: 'general' as const,
    text: fullTextPreview.text,
    characterCount: fullTextPreview.text.length,
  }];
  const warnings = html.messages.map((message) => message.message).filter(Boolean).slice(0, 5);

  if (fullTextPreview.truncated) {
    warnings.push(
      `DOCX 提取正文约 ${fullTextPreview.sourceCharacterCount.toLocaleString()} 个字符；为限制浏览器内存占用，全文预览只保留前 ${FULL_TEXT_PREVIEW_LIMIT.toLocaleString()} 个字符。请按章节导入并核对原始文件。`,
    );
  }
  if (sectionResult.truncatedSectionCount > 0) {
    warnings.push(
      `检测到 ${sectionResult.truncatedSectionCount} 个超长章节；章节预览每节最多保留 ${SECTION_PREVIEW_LIMIT.toLocaleString()} 个字符。请把超长章节拆分为更小范围后再导入。`,
    );
  }
  if (document.querySelector('table')) warnings.push('检测到表格：仅提取单元格文字，不保留表格结构。');
  warnings.push('公式、图片、脚注、批注、修订痕迹和页面样式不会导入；原始文件不会上传。');

  return {
    fileName: file.name,
    title,
    fullText: fullTextPreview.text,
    sections: safeSections,
    warnings: Array.from(new Set(warnings)),
    suggestedTask: inferTask(fullTextPreview.text),
  };
}
