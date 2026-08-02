'use client';

import { SECTION_LABELS, TASK_LABELS } from '@/lib/config';
import type { PersistedWorkspace, WorkspaceBackup, WorkspaceState } from '@/lib/types';
import { createBackup } from '@/lib/workspace/schema';

function safeStem(value: string) {
  return (value || 'scholarforge-task')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'scholarforge-task';
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function exportWorkingText(workspace: WorkspaceState) {
  downloadBlob(new Blob([workspace.workingText], { type: 'text/plain;charset=utf-8' }), `${safeStem(workspace.draft.projectName)}-author-draft.txt`);
}

export function reviewReportMarkdown(workspace: WorkspaceState) {
  const result = workspace.currentResult;
  const issues = result?.issues || [];
  const processed = issues.filter((issue) => (workspace.decisions[issue.id] || 'pending') !== 'pending').length;
  const decisionLabels = { pending: '待处理', accepted: '接受', rejected: '拒绝', deferred: '待定' } as const;
  const severityLabels = { major: '重大', minor: '一般', suggestion: '建议' } as const;
  const body = issues.map((issue, index) => {
    const decision = workspace.decisions[issue.id] || 'pending';
    return `### ${index + 1}. ${issue.category} · ${severityLabels[issue.severity]}\n\n- 位置：${issue.location}\n- 作者决定：${decisionLabels[decision]}\n- 是否可能改变科学含义：${issue.meaningChanged ? '是' : '否'}\n- 可安全应用：${issue.safeToApply ? '是' : `否（${issue.safetyReason || '需要人工核对'}）`}\n\n原文：\n\n> ${issue.original || '未提供'}\n\n建议：\n\n> ${issue.revised || '需要作者补充'}\n\n原因：${issue.reason}`;
  }).join('\n\n---\n\n');

  return `# ScholarForge 审校报告\n\n- 项目：${workspace.draft.projectName || '未命名任务'}\n- 任务：${TASK_LABELS[workspace.draft.taskType]}\n- 章节：${SECTION_LABELS[workspace.draft.sectionType]}\n- 生成时间：${result?.generatedAt || '尚未分析'}\n- 已处理：${processed}/${issues.length}\n- 已应用：${workspace.appliedEdits.length}\n\n## 重要说明\n\nAI 结果是供作者核对的建议，不是科研事实、引用、统计结论或期刊要求的最终验证。\n\n## 分析摘要\n\n${result?.summary || '尚未生成分析结果。'}\n\n## 问题与作者决定\n\n${body || '没有问题记录。'}\n`;
}

export function exportReviewReport(workspace: WorkspaceState) {
  downloadBlob(new Blob([reviewReportMarkdown(workspace)], { type: 'text/markdown;charset=utf-8' }), `${safeStem(workspace.draft.projectName)}-review-report.md`);
}

export function exportWorkspaceBackup(data: PersistedWorkspace) {
  const backup: WorkspaceBackup = createBackup(data);
  downloadBlob(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' }), `${safeStem(data.current.draft.projectName)}-workspace.json`);
}

export async function exportCleanDocx(workspace: WorkspaceState) {
  const { Document, Packer, Paragraph, TextRun } = await import('docx');
  const paragraphs = workspace.workingText.split(/\n{2,}/).map((paragraph) => new Paragraph({
    children: [new TextRun({ text: paragraph || ' ' })],
    spacing: { after: 180, line: 360 },
  }));
  const doc = new Document({
    creator: 'ScholarForge OS / Author',
    title: workspace.draft.projectName || 'Author working draft',
    description: 'Clean author working draft containing only the author manuscript text.',
    styles: {
      default: {
        document: { run: { font: 'Times New Roman', size: 24 }, paragraph: { spacing: { line: 360 } } },
      },
    },
    sections: [{
      properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children: paragraphs,
    }],
  });
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${safeStem(workspace.draft.projectName)}-author-draft.docx`);
}
