'use client';

import { useRouter } from 'next/navigation';
import { useWorkspace } from '@/components/workspace/use-workspace';
import { SECTION_LABELS, TASK_LABELS } from '@/lib/config';
import { exportReviewReport } from '@/lib/exports/files';

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
    if (!entry || !window.confirm(`恢复“${entry.projectName}”会替换当前工作区。当前任务仍会保留在最近任务中。确定继续吗？`)) return;
    const next = {
      ...data,
      current: entry.workspace,
      history: data.current.currentResult
        ? [
            {
              id: data.current.currentResult.id,
              projectName: data.current.draft.projectName || '未命名任务',
              taskType: data.current.draft.taskType,
              sectionType: data.current.draft.sectionType,
              sourceCharacterCount: data.current.draft.sourceText.length,
              issueCount: data.current.currentResult.issues.length,
              resolvedIssueCount: data.current.currentResult.issues.filter((issue) => (data.current.decisions[issue.id] || 'pending') !== 'pending').length,
              savedAt: new Date().toISOString(),
              workspace: data.current,
            },
            ...data.history.filter((item) => item.id !== id && item.id !== data.current.currentResult?.id),
          ].slice(0, 12)
        : data.history,
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
        <p>历史记录只保存在当前浏览器，最多 12 条。恢复前会保留当前已分析任务，不会静默覆盖。</p>
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
                  <button onClick={() => exportReviewReport(entry.workspace)} type="button">导出报告</button>
                  <button className="danger-button" onClick={() => remove(entry.id)} type="button">删除</button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state large"><strong>还没有已完成的任务</strong><p>完成一次分析后，结果和作者决定会出现在这里。</p><button className="primary-button" onClick={() => router.push('/workspace')} type="button">开始新任务</button></div>
      )}
    </div>
  );
}
