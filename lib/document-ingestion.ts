import type { ReviewSection, WorkspaceTask } from '@/lib/types';

export const DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;
export const WORKSPACE_TEXT_LIMIT = 12_000;

export type IngestedDocumentType = 'docx';

export interface IngestedSection {
  id: string;
  title: string;
  sectionType: ReviewSection;
  text: string;
  charCount: number;
  sourceLabel: string;
}

export interface IngestedDocument {
  fileName: string;
  fileType: IngestedDocumentType;
  title: string;
  fullText: string;
  sections: IngestedSection[];
  warnings: string[];
  suggestedTask: WorkspaceTask;
}

type StructuredBlock = {
  kind: 'heading' | 'paragraph';
  text: string;
  level?: number;
};

const SECTION_PATTERNS: Array<{ type: ReviewSection; pattern: RegExp; label: string }> = [
  { type: 'abstract', pattern: /^(abstract|摘要|摘\s*要)$/i, label: 'Abstract' },
  { type: 'introduction', pattern: /^(introduction|background|引言|绪论|研究背景)$/i, label: 'Introduction' },
  { type: 'methods', pattern: /^(materials?\s*(and|&)\s*methods?|methods?|methodology|experimental\s*(program|procedure|methods?)?|试验方法|实验方法|材料与方法|研究方法)$/i, label: 'Methods' },
  { type: 'results', pattern: /^(results?|experimental\s+results?|试验结果|实验结果|结果)$/i, label: 'Results' },
  { type: 'discussion', pattern: /^(discussion|results?\s*(and|&)\s*discussion|讨论|结果与讨论)$/i, label: 'Discussion' },
  { type: 'conclusion', pattern: /^(conclusions?|summary\s*(and|&)\s*conclusions?|结论|结语|总结与展望)$/i, label: 'Conclusion' },
];

function cleanText(value: string) {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeHeading(value: string) {
  return value
    .replace(/^\s*(chapter\s+)?\d+(?:\.\d+)*[.)、]?\s*/i, '')
    .replace(/^第[一二三四五六七八九十百0-9]+章\s*/, '')
    .replace(/[:：.]\s*$/, '')
    .trim();
}

function inferSectionType(title: string): ReviewSection {
  const normalized = normalizeHeading(title);
  return SECTION_PATTERNS.find((item) => item.pattern.test(normalized))?.type || 'general';
}

function preferredSectionTitle(type: ReviewSection, fallback: string) {
  return SECTION_PATTERNS.find((item) => item.type === type)?.label || fallback || 'Document section';
}

function looksLikeHeading(line: string) {
  const value = line.trim();
  if (!value || value.length > 100) return false;
  const normalized = normalizeHeading(value);
  if (SECTION_PATTERNS.some((item) => item.pattern.test(normalized))) return true;
  return /^(\d+(?:\.\d+){0,3}|[IVX]+)[.)、]?\s+[A-Z][^.!?]{2,80}$/.test(value);
}

function detectSuggestedTask(text: string): WorkspaceTask {
  const chinese = (text.match(/[\u3400-\u9fff]/g) || []).length;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  return chinese > Math.max(30, latin * 0.28) ? 'translate' : 'precheck';
}

function splitOversizedSection(section: IngestedSection): IngestedSection[] {
  if (section.charCount <= WORKSPACE_TEXT_LIMIT) return [section];
  const paragraphs = section.text.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    if (paragraph.length > WORKSPACE_TEXT_LIMIT) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      for (let offset = 0; offset < paragraph.length; offset += WORKSPACE_TEXT_LIMIT) {
        chunks.push(paragraph.slice(offset, offset + WORKSPACE_TEXT_LIMIT));
      }
      continue;
    }
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length > WORKSPACE_TEXT_LIMIT) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);

  return chunks.map((text, index) => ({
    ...section,
    id: `${section.id}-part-${index + 1}`,
    title: `${section.title} · Part ${index + 1}`,
    sourceLabel: `${section.sourceLabel} · ${index + 1}/${chunks.length}`,
    text,
    charCount: text.length,
  }));
}

function sectionsFromBlocks(blocks: StructuredBlock[], fallbackTitle: string): IngestedSection[] {
  const sections: IngestedSection[] = [];
  let currentTitle = fallbackTitle;
  let currentType: ReviewSection = 'general';
  let currentParagraphs: string[] = [];

  const flush = () => {
    const text = cleanText(currentParagraphs.join('\n\n'));
    if (text.length < 20) {
      currentParagraphs = [];
      return;
    }
    const title = preferredSectionTitle(currentType, currentTitle);
    sections.push(...splitOversizedSection({
      id: `section-${sections.length + 1}`,
      title,
      sectionType: currentType,
      text,
      charCount: text.length,
      sourceLabel: currentTitle,
    }));
    currentParagraphs = [];
  };

  for (const block of blocks) {
    if (block.kind === 'heading' && (block.level || 1) <= 3) {
      const type = inferSectionType(block.text);
      if (type !== 'general' || looksLikeHeading(block.text)) {
        flush();
        currentTitle = normalizeHeading(block.text) || block.text;
        currentType = type;
        continue;
      }
    }
    if (block.text.trim()) currentParagraphs.push(block.text.trim());
  }
  flush();

  if (!sections.length) {
    const text = cleanText(blocks.map((block) => block.text).join('\n\n'));
    if (text) {
      sections.push(...splitOversizedSection({
        id: 'section-1',
        title: fallbackTitle,
        sectionType: 'general',
        text,
        charCount: text.length,
        sourceLabel: 'Full extracted text',
      }));
    }
  }
  return sections;
}

function blocksFromPlainText(text: string): StructuredBlock[] {
  return cleanText(text).split(/\n+/).map((line) => ({
    kind: looksLikeHeading(line) ? 'heading' as const : 'paragraph' as const,
    text: line,
    level: looksLikeHeading(line) ? 1 : undefined,
  })).filter((block) => block.text.trim());
}

async function extractDocx(file: File): Promise<IngestedDocument> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const [htmlResult, textResult] = await Promise.all([
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

  const document = new DOMParser().parseFromString(htmlResult.value, 'text/html');
  const blocks: StructuredBlock[] = Array.from(document.body.querySelectorAll('h1,h2,h3,h4,p,li,td'))
    .map((node) => ({
      kind: /^H[1-4]$/.test(node.tagName) ? 'heading' as const : 'paragraph' as const,
      level: /^H[1-4]$/.test(node.tagName) ? Number(node.tagName.slice(1)) : undefined,
      text: cleanText(node.textContent || ''),
    }))
    .filter((block) => block.text);

  const fileTitle = file.name.replace(/\.docx$/i, '');
  const fullText = cleanText(textResult.value);
  const warnings = htmlResult.messages.map((message) => message.message).slice(0, 6);
  if (document.querySelector('table')) warnings.push('检测到表格：导入仅保留单元格文字，不保留边框、合并关系和版式。');
  warnings.push('公式、图片、批注与修订痕迹不会作为可编辑结构导入，请在开始审阅前核对正文。');

  return {
    fileName: file.name,
    fileType: 'docx',
    title: fileTitle,
    fullText,
    sections: sectionsFromBlocks(blocks.length ? blocks : blocksFromPlainText(fullText), fileTitle),
    warnings: Array.from(new Set(warnings)),
    suggestedTask: detectSuggestedTask(fullText),
  };
}

export async function ingestResearchDocument(file: File): Promise<IngestedDocument> {
  if (file.size > DOCUMENT_MAX_BYTES) throw new Error('文件超过 20 MB，请压缩或拆分后再导入。');
  if (file.name.toLowerCase().endsWith('.docx')) return extractDocx(file);
  throw new Error('当前只支持 DOCX 文件。PDF 请先复制需要处理的文本，再粘贴到工作台。');
}
