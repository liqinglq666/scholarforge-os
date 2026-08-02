import { MAX_DOCX_BYTES, MAX_SOURCE_CHARACTERS } from '@/lib/config';
import type { SectionType, TaskType } from '@/lib/types';
import { cleanText } from '@/lib/validation/common';

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

function sectionsFromHtml(document: Document, fallbackTitle: string): DocumentSection[] {
  const sections: DocumentSection[] = [];
  let title = fallbackTitle;
  let sectionType: SectionType = 'general';
  let paragraphs: string[] = [];

  const flush = () => {
    const text = cleanText(paragraphs.join('\n\n'), MAX_SOURCE_CHARACTERS * 4);
    paragraphs = [];
    if (text.length < 20) return;
    const detected = SECTION_PATTERNS.find((item) => item.sectionType === sectionType);
    sections.push({
      id: `section-${sections.length + 1}`,
      title: detected?.label || title || fallbackTitle,
      sectionType,
      text,
      characterCount: text.length,
    });
  };

  for (const node of Array.from(document.body.querySelectorAll('h1,h2,h3,p,li'))) {
    const value = cleanText(node.textContent, MAX_SOURCE_CHARACTERS * 4);
    if (!value) continue;
    if (/^H[1-3]$/.test(node.tagName)) {
      flush();
      title = normalizeHeading(value) || value;
      sectionType = inferSectionType(value);
    } else {
      paragraphs.push(value);
    }
  }
  flush();
  return sections;
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
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const [html, raw] = await Promise.all([
    mammoth.convertToHtml({ arrayBuffer }, {
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
      ],
    }),
    mammoth.extractRawText({ arrayBuffer }),
  ]);
  const fullText = cleanText(raw.value, MAX_SOURCE_CHARACTERS * 20);
  if (!fullText) throw new Error('DOCX 中没有提取到可用正文。');

  const document = new DOMParser().parseFromString(html.value, 'text/html');
  const title = file.name.replace(/\.docx$/i, '');
  const sections = sectionsFromHtml(document, title);
  const safeSections = sections.length ? sections : [{
    id: 'section-1',
    title,
    sectionType: 'general' as const,
    text: fullText,
    characterCount: fullText.length,
  }];
  const warnings = html.messages.map((message) => message.message).filter(Boolean).slice(0, 5);
  if (document.querySelector('table')) warnings.push('检测到表格：仅提取单元格文字，不保留表格结构。');
  warnings.push('公式、图片、脚注、批注、修订痕迹和页面样式不会导入；原始文件不会上传。');

  return {
    fileName: file.name,
    title,
    fullText,
    sections: safeSections,
    warnings: Array.from(new Set(warnings)),
    suggestedTask: inferTask(fullText),
  };
}
