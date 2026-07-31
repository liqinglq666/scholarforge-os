import { APP_VERSION } from '@/lib/app-config';
import type { AppliedEdit } from '@/lib/author-editing';
import { composeWorkingText } from '@/lib/author-editing';

export interface AuthorDocxExportOptions {
  projectTitle: string;
  targetJournal?: string;
  sectionLabel?: string;
  sourceText: string;
  edits: AppliedEdit[];
}

function safeFileStem(value: string) {
  return (value || 'scholarforge-manuscript')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 90) || 'scholarforge-manuscript';
}

function paragraphs(value: string) {
  return value.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportAuthorDocx(options: AuthorDocxExportOptions) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
  const workingText = composeWorkingText(options.sourceText, [...options.edits].sort((a, b) => a.start - b.start));

  const doc = new Document({
    creator: 'ScholarForge OS',
    title: options.projectTitle || 'ScholarForge manuscript',
    description: 'Author-reviewed scientific manuscript working copy.',
    styles: {
      default: {
        document: {
          run: { font: 'Times New Roman', size: 24 },
          paragraph: { spacing: { line: 360 } },
        },
      },
    },
    sections: [{
      properties: {
        page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
      },
      children: [
        new Paragraph({ text: options.projectTitle || 'ScholarForge manuscript', heading: HeadingLevel.TITLE }),
        new Paragraph({
          children: [
            new TextRun({ text: `ScholarForge OS v${APP_VERSION}`, bold: true }),
            new TextRun({ text: ` · ${options.sectionLabel || 'General section'}` }),
          ],
        }),
        ...(options.targetJournal ? [new Paragraph({ text: `Target journal: ${options.targetJournal}` })] : []),
        new Paragraph({ text: `Applied suggestions: ${options.edits.length}` }),
        ...paragraphs(workingText).map((text) => new Paragraph({
          children: [new TextRun({ text })],
          spacing: { before: 160, after: 180, line: 360 },
        })),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${safeFileStem(options.projectTitle)}-working-manuscript.docx`);
}
