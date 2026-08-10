'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { useWorkspace } from '@/components/workspace/use-workspace';
import { SECTION_LABELS, TASK_LABELS } from '@/lib/config';
import { exportReviewReport } from '@/lib/exports/files';
import { createHistoryEntry } from '@/lib/workspace/schema';

type PendingHistoryAction = {
  kind: 'restore' | 'remove';
  id: string;
  title: string;
  description: string;
  confirmLabel: string;
  tone: 'default' | 'danger';
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '时间未知' : date.toLocaleString('zh-CN');
}

export function HistoryManager() {
  const router = useRouter();
  const { data, ready, replaceData, saveNow } = useWorkspace();
  const [pendingAction, setPendingAction] = useState<PendingHistoryAction | null>(null);

  if (!ready) return <div className="loading-state" role="status"><span className="spinner" /><strong>正在读取最近任务</strong></div>;

  function requestRestore(id: string) {
    const entry = data.history.find((item) => item.id === id);
    if (!entry) return;
    const hasCurrentWork = Boolean(data.current.currentResult || data.current.draft.sourceText.trim());
    setPendingAction({
      kind: 'restore',
      id,
      title: `恢复“${entry.projectName}”？`,
      description: hasCurrentWork
        ? '这会替换当前工作区。当前草稿或分析结果会先保存到最近任务，因此不会静默丢失。'
        : '这会把该记录恢复到当前工作区，并从最近任务列表中移除这一条恢复来源。',
      confirmLabel: '确认恢复',
      tone: 'default',
    });
  }

  function restoreConfirmed(id: string) {
    const entry = data.history.find((item) => item.id === id);
    if (!entry) return;
    const hasCurrentWork = Boolean(data.current.currentResult || data.current.draft.sourceText.trim());
    const preservedCurrent = hasCurrentWork ? createHistoryEntry(data.current) : null;
    const history = [
      ...(preservedCurrent && preservedCurrent.id !== id ? [preservedCurrent] : []),
      ...data.history.filter((item) => item.id !== id && item.id !== preservedCurrent?.id),
    ].slice(0, 12);
    const next = {
      ...data,
      current: entry.workspace,
      history,
      updatedAt: new Date().toISOString(),
    };
    replaceData(next);
    saveNow(next);
    router.push('/workspace');
  }

  function requestRemove(id: string) {
    const entry = data.history.find((item) => item.id === id);
    if (!entry) return;
    setPendingAction({
      kind: 'remove',
      id,
      title: `删除“${entry.projectName}”？`,
      description: '这条最近任务记录会从当前浏览器永久删除，无法撤销。建议先导出报告或工作区备份。',
      confirmLabel: '确认删除',
      tone: 'danger',
    });
  }

  function removeConfirmed(id: string) {
    if (!data.history.some((item) => item.id === id)) return;
    const next = { ...data, history: data.history.filter((item) => item.id !== id), updatedAt: new Date().toISOString() };
    replaceData(next);
    saveNow(next);
  }

  function confirmPendingAction() {
    const action = pendingAction;
    if (!action) return;
    setPendingAction(null);
    if (action.kind === 'restore') restoreConfirmed(action.id);
    else removeConfirmed(action.id);
  }

  return (
    <div className="history-content">
      <div className="page-heading">
        <div><span className="eyebrow">本地历史</span><h1>恢复最近任务</h1></div>
        <p>历史记录只保存在当前浏览器，最多 12 条。恢复前会保存当前有内容的草稿或分析结果，不会静默覆盖。</p>
      </div>
      {data.history.length ? (
        <div className="history-list">
          {data.history.map((entry) => {
            const pending = entry.issueCount - entry.resolvedIssueCount;
            return (
              <article key={entry.id}>
                <div className="history-meta"><span>{TASK_LABELS[entry.taskType]}</span><span>{SECTION_LABELS[entry.sectionType]}</span><time dateTime={entry.savedAt}>{formatDate(entry.savedAt)}</time></div>
                <h2>{entry.projectName}</h2>
                <p>{entry.sourceCharacterCount.toLocaleString()} 字符 · {entry.issueCount} 条问题 · {pending} 条待处理 · {entry.workspace.appliedEdits.length} 条已应用</p>
                <div className="history-actions">
                  <button className="primary-button" onClick={() => requestRestore(entry.id)} type="button">恢复到工作台</button>
                  {entry.workspace.currentResult ? <button onClick={() => exportReviewReport(entry.workspace)} type="button">导出报告</button> : null}
                  <button className="danger-button" onClick={() => requestRemove(entry.id)} type="button">删除</button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state large"><strong>还没有最近任务</strong><p>开始输入后可导出备份；完成一次分析后，结果和作者决定会出现在这里。</p><button className="primary-button" onClick={() => router.push('/workspace')} type="button">开始新任务</button></div>
      )}
      <ConfirmDialog
        confirmLabel={pendingAction?.confirmLabel}
        description={pendingAction?.description || ''}
        eyebrow={pendingAction?.kind === 'remove' ? '删除最近任务' : '恢复最近任务'}
        onCancel={() => setPendingAction(null)}
        onConfirm={confirmPendingAction}
        open={Boolean(pendingAction)}
        title={pendingAction?.title || ''}
        tone={pendingAction?.tone}
      />
    </div>
  );
}
