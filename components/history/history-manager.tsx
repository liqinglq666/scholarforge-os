'use client';

import { useRouter } from 'next/navigation';
import { useWorkspace } from '@/components/workspace/use-workspace';
import { SECTION_LABELS, TASK_LABELS } from '@/lib/config';
import { exportReviewReport } from '@/lib/exports/files';
import { createHistoryEntry } from '@/lib/workspace/schema';

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '时间未知' : date.toLocaleString('zh-CN');
}

export function HistoryManager() {
  const router = useRouter();
  const { data, ready, replaceData, saveNow } = useWorkspace();

  if (!ready) return <div className="loading-state" role="status"><span className="spinner" /><strong>正在读取最近任务</strong></div>;

  function restore(id: string) {
    const entry = data.history.find((item) => item.id === id);
    if (!entry) return;
    const hasCurrentWork = Boolean(data.current.currentResult || data.current.draft.sourceText.trim());
    const message = hasCurrentWork
      ? `恢复“${entry.projectName}”会替换当前工作区。当前草稿或结果会先保存到最近任务。确定继续吗？`
      : `恢复“${entry.projectName}”到当前工作区？`;
    if (!window.confirm(message)) return;

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

  function remove(id: string) {
    const entry = data.history.find((item) => item.id === id);
    if (!entry || !window.confirm(`从最近任务中删除“${entry.projectName}”？此操作无法撤销，建议先导出备份。`)) return;
    const next = { ...data, history: data.history.filter((item) => item.id !== id), updatedAt: new Date().toISOString() };
    replaceData(next);
    saveNow(next);
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
                  <button className="primary-button" onClick={() => restore(entry.id)} type="button">恢复到工作台</button>
                  {entry.workspace.currentResult ? <button onClick={() => exportReviewReport(entry.workspace)} type="button">导出报告</button> : null}
                  <button className="danger-button" onClick={() => remove(entry.id)} type="button">删除</button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state large"><strong>还没有最近任务</strong><p>开始输入后可导出备份；完成一次分析后，结果和作者决定会出现在这里。</p><button className="primary-button" onClick={() => router.push('/workspace')} type="button">开始新任务</button></div>
      )}
    </div>
  );
}
