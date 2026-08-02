'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { StatusBanner } from '@/components/feedback/status-banner';
import { useWorkspace } from '@/components/workspace/use-workspace';
import { splitSupervisorFeedback } from '@/lib/project/feedback';
import { exportSupervisorFeedback } from '@/lib/project/reports';
import type {
  ManuscriptProject,
  SupervisorFeedbackItem,
  SupervisorFeedbackPriority,
  SupervisorFeedbackStatus,
} from '@/lib/types';
import { createSupervisorFeedbackItem } from '@/lib/workspace/schema';

const STATUS_LABELS: Record<SupervisorFeedbackStatus, string> = {
  pending: '未处理',
  in_progress: '处理中',
  completed: '已完成',
  needs_clarification: '需要向导师确认',
  not_adopted: '不采纳',
};

const PRIORITY_LABELS: Record<SupervisorFeedbackPriority, string> = {
  high: '高优先级',
  normal: '普通',
  low: '低优先级',
};

export function FeedbackManager() {
  const { data, ready, saveState, saveMessage, replaceData } = useWorkspace();
  const [bulkText, setBulkText] = useState('');
  const [defaultChapterId, setDefaultChapterId] = useState('');
  const [filter, setFilter] = useState<'all' | SupervisorFeedbackStatus>('all');
  const [message, setMessage] = useState('');
  const project = data.project || null;

  const visibleItems = useMemo(() => {
    if (!project) return [];
    return filter === 'all'
      ? project.supervisorFeedback
      : project.supervisorFeedback.filter((item) => item.status === filter);
  }, [filter, project]);

  function commitProject(nextProject: ManuscriptProject) {
    replaceData({
      ...data,
      project: { ...nextProject, updatedAt: new Date().toISOString() },
      updatedAt: new Date().toISOString(),
    });
  }

  function addBulkFeedback() {
    if (!project) return;
    const parsed = splitSupervisorFeedback(bulkText);
    if (!parsed.length) {
      setMessage('没有识别到可保存的导师意见。请按编号、项目符号或空行分隔。');
      return;
    }
    const remaining = Math.max(0, 120 - project.supervisorFeedback.length);
    const chapterId = defaultChapterId || project.activeChapterId;
    const newItems = parsed.slice(0, remaining).map((comment) => createSupervisorFeedbackItem({
      comment,
      chapterId: project.chapters.some((chapter) => chapter.id === chapterId) ? chapterId : undefined,
    }));
    if (!newItems.length) {
      setMessage('导师意见已达到 120 条上限。请先整理或导出已有记录。');
      return;
    }
    commitProject({ ...project, supervisorFeedback: [...newItems, ...project.supervisorFeedback] });
    setBulkText('');
    setMessage(`已拆分并保存 ${newItems.length} 条导师意见。系统不会自动把它们标记为已完成。`);
  }

  function updateItem(id: string, patch: Partial<SupervisorFeedbackItem>) {
    if (!project) return;
    commitProject({
      ...project,
      supervisorFeedback: project.supervisorFeedback.map((item) => item.id === id
        ? { ...item, ...patch, updatedAt: new Date().toISOString() }
        : item),
    });
  }

  function updateStatus(item: SupervisorFeedbackItem, status: SupervisorFeedbackStatus) {
    if ((status === 'completed' || status === 'not_adopted') && !item.authorResponse.trim()) {
      setMessage(status === 'completed'
        ? '标记“已完成”前，请填写具体修改位置或处理说明。'
        : '标记“不采纳”前，请填写不采纳的理由。');
      return;
    }
    updateItem(item.id, {
      status,
      completedAt: status === 'completed' ? new Date().toISOString() : undefined,
    });
    setMessage('');
  }

  function removeItem(item: SupervisorFeedbackItem) {
    if (!project || !window.confirm('删除这条导师意见及其处理说明？此操作无法撤销。')) return;
    commitProject({
      ...project,
      supervisorFeedback: project.supervisorFeedback.filter((entry) => entry.id !== item.id),
      revisionComparisons: project.revisionComparisons.map((comparison) => ({
        ...comparison,
        changes: comparison.changes.map((change) => change.feedbackId === item.id
          ? { ...change, feedbackId: undefined }
          : change),
      })),
    });
  }

  if (!ready) return <div className="loading-state" role="status"><span className="spinner" /><strong>正在读取导师意见</strong></div>;

  if (!project) {
    return (
      <div className="project-empty compact-empty">
        <span className="eyebrow">导师意见处理器</span>
        <h1>先创建论文项目</h1>
        <p>导师意见需要关联论文项目和章节，才能形成可追踪的处理记录与修改说明。</p>
        <Link className="primary-link" href="/project">创建论文项目</Link>
      </div>
    );
  }

  const completed = project.supervisorFeedback.filter((item) => item.status === 'completed').length;
  const needsClarification = project.supervisorFeedback.filter((item) => item.status === 'needs_clarification').length;
  const unresolved = project.supervisorFeedback.filter((item) => item.status === 'pending' || item.status === 'in_progress').length;

  return (
    <div className="feedback-content">
      <div className={`save-indicator save-${saveState}`} aria-live="polite"><span aria-hidden="true" />{saveMessage}</div>
      <div className="page-heading project-heading">
        <div><span className="eyebrow">导师意见处理器 · v2.2</span><h1>把导师意见变成可核对的任务</h1></div>
        <p>保留导师原话，关联章节，记录作者如何处理。系统不会自动声称意见已完成，也不会生成虚假的回复。</p>
      </div>

      {message ? <StatusBanner tone="neutral" title="操作提示">{message}</StatusBanner> : null}

      <section className="feedback-summary" aria-label="导师意见进度">
        <article><strong>{project.supervisorFeedback.length}</strong><span>意见总数</span></article>
        <article><strong>{unresolved}</strong><span>待处理或处理中</span></article>
        <article><strong>{completed}</strong><span>作者标记已完成</span></article>
        <article><strong>{needsClarification}</strong><span>需要向导师确认</span></article>
      </section>

      <section className="project-section feedback-import" aria-labelledby="feedback-import-title">
        <div className="project-section-heading"><div><span className="step-number">01</span><h2 id="feedback-import-title">批量粘贴导师意见</h2></div><p>支持编号、项目符号或空行分隔。</p></div>
        <textarea
          aria-label="批量导师意见"
          maxLength={30_000}
          onChange={(event) => setBulkText(event.target.value)}
          placeholder={'1. 摘要需要明确研究对象和样本量。\n2. 讨论部分不要重复结果，应解释可能机制。\n3. 请核对表2与正文中的数值。'}
          value={bulkText}
        />
        <div className="feedback-import-actions">
          <label><span>默认关联章节</span><select onChange={(event) => setDefaultChapterId(event.target.value)} value={defaultChapterId}><option value="">当前章节或暂不关联</option>{project.chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}</select></label>
          <button className="primary-button" disabled={!bulkText.trim() || project.supervisorFeedback.length >= 120} onClick={addBulkFeedback} type="button">拆分并保存</button>
        </div>
      </section>

      <section className="project-section" aria-labelledby="feedback-list-title">
        <div className="project-section-heading feedback-list-heading">
          <div><span className="step-number">02</span><h2 id="feedback-list-title">逐条处理</h2></div>
          <div className="feedback-toolbar">
            <label><span className="sr-only">筛选状态</span><select onChange={(event) => setFilter(event.target.value as 'all' | SupervisorFeedbackStatus)} value={filter}><option value="all">全部状态</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <button disabled={!project.supervisorFeedback.length} onClick={() => exportSupervisorFeedback(project)} type="button">导出处理记录</button>
          </div>
        </div>

        {visibleItems.length ? (
          <ul className="feedback-list">
            {visibleItems.map((item, index) => (
              <li className={`feedback-card feedback-status-${item.status}`} key={item.id}>
                <div className="feedback-card-header">
                  <div><span>{STATUS_LABELS[item.status]}</span><strong>意见 {index + 1}</strong></div>
                  <button className="danger-button" onClick={() => removeItem(item)} type="button">删除</button>
                </div>
                <label className="full-width"><span>导师原话</span><textarea aria-label={`导师意见 ${index + 1}`} maxLength={3_000} onChange={(event) => updateItem(item.id, { comment: event.target.value })} value={item.comment} /></label>
                <div className="form-grid three-columns feedback-fields">
                  <label><span>关联章节</span><select onChange={(event) => updateItem(item.id, { chapterId: event.target.value || undefined })} value={item.chapterId || ''}><option value="">暂不关联</option>{project.chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}</select></label>
                  <label><span>优先级</span><select onChange={(event) => updateItem(item.id, { priority: event.target.value as SupervisorFeedbackPriority })} value={item.priority}>{Object.entries(PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <label><span>处理状态</span><select onChange={(event) => updateStatus(item, event.target.value as SupervisorFeedbackStatus)} value={item.status}>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <label className="full-width"><span>原文位置或修改位置</span><input maxLength={240} onChange={(event) => updateItem(item.id, { location: event.target.value })} placeholder="例如：Discussion 第2段、表2后第一句" value={item.location || ''} /></label>
                  <label className="full-width"><span>作者处理说明</span><textarea maxLength={4_000} onChange={(event) => updateItem(item.id, { authorResponse: event.target.value })} placeholder="说明改了什么、在哪里修改、为什么需要向导师确认，或不采纳的依据。" value={item.authorResponse} /></label>
                </div>
                <small>“已完成”只代表作者在本地标记完成，不代表导师已确认。</small>
              </li>
            ))}
          </ul>
        ) : <div className="empty-state project-report-empty"><strong>当前筛选下没有导师意见</strong><p>从上方粘贴意见，或切换状态筛选。</p></div>}
      </section>
    </div>
  );
}
