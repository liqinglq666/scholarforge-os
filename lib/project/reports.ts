'use client';

import { downloadBlob } from '@/lib/exports/files';
import { revisionChangeCounts } from '@/lib/project/revisions';
import type { ManuscriptProject, RevisionComparison } from '@/lib/types';

const STATUS_LABELS = {
  pending: '未处理',
  in_progress: '处理中',
  completed: '已完成',
  needs_clarification: '需要向导师确认',
  not_adopted: '不采纳',
} as const;

const PRIORITY_LABELS = { high: '高', normal: '普通', low: '低' } as const;
const KIND_LABELS = { added: '新增', removed: '删除', modified: '修改' } as const;
const SOURCE_LABELS = { author: '作者修改', ai: 'AI 建议后由作者确认', supervisor: '导师意见', unknown: '未标记' } as const;

function safeStem(value: string) {
  return (value || 'scholarforge-project')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'scholarforge-project';
}

function quote(value: string) {
  return value ? `> ${value.replace(/\n/g, '\n> ')}` : '> 未填写';
}

export function supervisorFeedbackMarkdown(project: ManuscriptProject) {
  const chapters = new Map(project.chapters.map((chapter) => [chapter.id, chapter.title]));
  const body = project.supervisorFeedback.map((item, index) => `## ${index + 1}. ${STATUS_LABELS[item.status]} · ${PRIORITY_LABELS[item.priority]}优先级

- 关联章节：${item.chapterId ? chapters.get(item.chapterId) || '章节已移除' : '未关联'}
- 位置：${item.location || '未填写'}
- 创建时间：${item.createdAt}
- 更新时间：${item.updatedAt}

### 导师原话

${quote(item.comment)}

### 作者处理说明

${quote(item.authorResponse)}
`).join('\n---\n\n');
  const completed = project.supervisorFeedback.filter((item) => item.status === 'completed').length;
  return `# 导师意见处理记录

- 论文项目：${project.name || '未命名项目'}
- 导师意见总数：${project.supervisorFeedback.length}
- 已完成：${completed}
- 待处理或处理中：${project.supervisorFeedback.filter((item) => item.status === 'pending' || item.status === 'in_progress').length}
- 需要确认：${project.supervisorFeedback.filter((item) => item.status === 'needs_clarification').length}
- 不采纳：${project.supervisorFeedback.filter((item) => item.status === 'not_adopted').length}
- 导出时间：${new Date().toISOString()}

## 使用说明

“已完成”仅表示作者在本工作区中标记为完成，不代表导师已确认。所有处理说明均应由作者核对。

${body || '尚无导师意见。'}
`;
}

export function exportSupervisorFeedback(project: ManuscriptProject) {
  downloadBlob(
    new Blob([supervisorFeedbackMarkdown(project)], { type: 'text/markdown;charset=utf-8' }),
    `${safeStem(project.name)}-supervisor-feedback.md`,
  );
}

export function revisionReportMarkdown(project: ManuscriptProject, comparison: RevisionComparison) {
  const chapter = comparison.chapterId
    ? project.chapters.find((item) => item.id === comparison.chapterId)?.title || '章节已移除'
    : '未关联章节';
  const feedback = new Map(project.supervisorFeedback.map((item) => [item.id, item]));
  const counts = revisionChangeCounts(comparison.changes);
  const body = comparison.changes.map((change, index) => {
    const linked = change.feedbackId ? feedback.get(change.feedbackId) : null;
    return `## ${index + 1}. ${KIND_LABELS[change.kind]}

- 修改来源：${SOURCE_LABELS[change.source]}
- 修改原因：${change.reason || '未填写'}
- 关联导师意见：${linked ? linked.comment : '未关联'}

### 修改前

${quote(change.before)}

### 修改后

${quote(change.after)}
`;
  }).join('\n---\n\n');

  return `# 论文版本修改说明

- 论文项目：${project.name || '未命名项目'}
- 比较名称：${comparison.title}
- 关联章节：${chapter}
- 基线版本：${comparison.baseLabel}
- 修改版本：${comparison.revisedLabel}
- 新增：${counts.added}
- 删除：${counts.removed}
- 修改：${counts.modified}
- 生成时间：${comparison.updatedAt}

## 重要说明

本报告基于本地句子级比较生成。修改来源和修改原因由作者标记；系统不会自动声称导师意见已完成。

${body || '两个版本没有发现内容差异。'}
`;
}

export function exportRevisionReport(project: ManuscriptProject, comparison: RevisionComparison) {
  downloadBlob(
    new Blob([revisionReportMarkdown(project, comparison)], { type: 'text/markdown;charset=utf-8' }),
    `${safeStem(project.name)}-${safeStem(comparison.title)}-revision-report.md`,
  );
}
