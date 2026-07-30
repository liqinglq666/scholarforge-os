import type { ReviewMode, ReviewSection, WorkspaceTask } from '@/lib/types';

export const DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;
export const WORKSPACE_TEXT_LIMIT = 12_000;

export type IngestedDocumentType = 'docx' | 'pdf';

export interface IngestedSection {
  id: string;
  title: string;
  sectionType: ReviewSection;
  text: string;
  charCount: number;
  sourceLabel: string;
  pageStart?: number;
  pageEnd?: number;
}

export interface IngestedDocument {
  fileName: string;
  fileType: IngestedDocumentType;
  title: string;
  fullText: string;
  pageCount?: number;
  sections: IngestedSection[];
  warnings: string[];
  suggestedTask: WorkspaceTask;
  suggestedMode: ReviewMode;
}

type StructuredBlock = {
  kind: 'heading' | 'paragraph';
  text: string;
  level?: number;
  page?: number;
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
  let startPage: number | undefined;
  let endPage: number | undefined;

  const flush = () => {
    const text = cleanText(currentParagraphs.join('\n\n'));
    if (text.length < 20) {
      currentParagraphs = [];
      startPage = undefined;
      endPage = undefined;
      return;
    }
    const title = preferredSectionTitle(currentType, currentTitle);
    const section: IngestedSection = {
      id: `section-${sections.length + 1}`,
      title,
      sectionType: currentType,
      text,
      charCount: text.length,
      sourceLabel: startPage ? `Pages ${startPage}${endPage && endPage !== startPage ? `–${endPage}` : ''}` : currentTitle,
      pageStart: startPage,
      pageEnd: endPage,
    };
    sections.push(...splitOversizedSection(section));
    currentParagraphs = [];
    startPage = undefined;
    endPage = undefined;
  };

  for (const block of blocks) {
    if (block.kind === 'heading' && (block.level || 1) <= 3) {
      const type = inferSectionType(block.text);
      if (type !== 'general' || looksLikeHeading(block.text)) {
        flush();
        currentTitle = normalizeHeading(block.text) || block.text;
        currentType = type;
        startPage = block.page;
        endPage = block.page;
        continue;
      }
    }
    if (block.text.trim()) {
      currentParagraphs.push(block.text.trim());
      if (block.page) {
        startPage ||= block.page;
        endPage = block.page;
      }
    }
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

function blocksFromPlainText(text: string, page?: number): StructuredBlock[] {
  return cleanText(text).split(/\n+/).map((line) => ({
    kind: looksLikeHeading(line) ? 'heading' as const : 'paragraph' as const,
    text: line,
    level: looksLikeHeading(line) ? 1 : undefined,
    page,
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
  warnings.push('公式、图片、批注与修订痕迹不会作为可编辑结构导入，请在开始审校前核对正文。');

  return {
    fileName: file.name,
    fileType: 'docx',
    title: fileTitle,
    fullText,
    sections: sectionsFromBlocks(blocks.length ? blocks : blocksFromPlainText(fullText), fileTitle),
    warnings: Array.from(new Set(warnings)),
    suggestedTask: detectSuggestedTask(fullText),
    suggestedMode: 'balanced',
  };
}

async function extractPdf(file: File): Promise<IngestedDocument> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@6.1.200/legacy/build/pdf.worker.min.mjs';
  }
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data, isEvalSupported: false });
  const pdf = await loadingTask.promise;
  const blocks: StructuredBlock[] = [];
  const pageTexts: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const lines: string[] = [];
    let current = '';
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const token = item.str.trim();
      if (token) current = current ? `${current} ${token}` : token;
      if (item.hasEOL && current) {
        lines.push(current);
        current = '';
      }
    }
    if (current) lines.push(current);
    const pageText = cleanText(lines.join('\n'));
    pageTexts.push(pageText);
    blocks.push(...blocksFromPlainText(pageText, pageNumber));
  }

  const fullText = cleanText(pageTexts.join('\n\n'));
  const fileTitle = file.name.replace(/\.pdf$/i, '');
  const warnings = [
    'PDF 导入按页面读取可选择文本；页眉、页脚、双栏顺序、公式和表格可能需要人工校正。',
    '原始 PDF 不会保存到 ScholarForge；只有你选中的文本在启动工作流后才会提交处理。',
  ];
  if (fullText.length < Math.max(80, pdf.numPages * 45)) {
    warnings.unshift('提取到的文字很少，这可能是扫描图片型 PDF。当前版本不执行 OCR，请改用可复制文本的 PDF 或 DOCX。');
  }

  return {
    fileName: file.name,
    fileType: 'pdf',
    title: fileTitle,
    fullText,
    pageCount: pdf.numPages,
    sections: sectionsFromBlocks(blocks, fileTitle),
    warnings,
    suggestedTask: detectSuggestedTask(fullText),
    suggestedMode: 'deep',
  };
}

export async function ingestResearchDocument(file: File): Promise<IngestedDocument> {
  if (file.size > DOCUMENT_MAX_BYTES) throw new Error('文件超过 20 MB，请压缩或拆分后再导入。');
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.docx')) return extractDocx(file);
  if (lowerName.endsWith('.pdf')) return extractPdf(file);
  throw new Error('当前仅支持 DOCX 和 PDF 文件。');
}
