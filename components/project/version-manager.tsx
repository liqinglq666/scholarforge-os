'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { StatusBanner } from '@/components/feedback/status-banner';
import { useWorkspace } from '@/components/workspace/use-workspace';
import { getProject, upsertProject } from '@/lib/project/workspace';
import { exportRevisionReport } from '@/lib/project/reports';
import { compareRevisionTexts, revisionChangeCounts } from '@/lib/project/revisions';
import type {
  ManuscriptProject,
  RevisionChange,
  RevisionChangeSource,
  RevisionComparison,
} from '@/lib/types';
import { createRevisionComparison } from '@/lib/workspace/schema';

const SOURCE_LABELS: Record<RevisionChangeSource, string> = {
  unknown: '未标记',
  author: '作者修改',
  ai: 'AI 建议后由作者确认',
  supervisor: '导师意见',
};

const KIND_LABELS = { added: '新增', removed: '删除', modified: '修改' } as const;

export function VersionManager({ projectId }: { projectId: string }) {
  const { data, ready, saveState, saveMessage, replaceData } = useWorkspace();
  const project = getProject(data, projectId);
  const [selectedId, setSelectedId] = useState('');
  const [title, setTitle] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [baseLabel, setBaseLabel] = useState('修改前');
  const [revisedLabel, setRevisedLabel] = useState('修改后');
  const [baseText, setBaseText] = useState('');
  const [revisedText, setRevisedText] = useState('');
  const [changes, setChanges] = useState<RevisionChange[]>([]);
  const [message, setMessage] = useState('');

  const counts = useMemo(() => revisionChangeCounts(changes), [changes]);

  function commitProject(nextProject: ManuscriptProject) {
    replaceData(upsertProject(data, { ...nextProject, updatedAt: new Date().toISOString() }));
  }

  function resetEditor() {
    setSelectedId('');
    setTitle('');
    setChapterId(project?.activeChapterId || '');
    setBaseLabel('修改前');
    setRevisedLabel('修改后');
    setBaseText('');
    setRevisedText('');
    setChanges([]);
    setMessage('');
  }

  function loadSaved(comparison: RevisionComparison) {
    setSelectedId(comparison.id);
    setTitle(comparison.title);
    setChapterId(comparison.chapterId || '');
    setBaseLabel(comparison.baseLabel);
    setRevisedLabel(comparison.revisedLabel);
    setBaseText(comparison.baseText);
    setRevisedText(comparison.revisedText);
    setChanges(comparison.changes.map((change) => ({ ...change })));
    setMessage(`已载入“${comparison.title}”。修改后请重新保存。`);
  }

  function loadChapterAsRevised() {
    if (!project) return;
    const chapter = project.chapters.find((item) => item.id === chapterId)
      || project.chapters.find((item) => item.id === project.activeChapterId)
      || project.chapters[0];
    if (!chapter) return;
    setChapterId(chapter.id);
    setRevisedText(chapter.text);
    if (!title) setTitle(`${chapter.title}修改说明`);
    setMessage(`已把项目中的“${chapter.title}”载入为修改后版本。`);
  }

  function swapVersions() {
    setBaseText(revisedText);
    setRevisedText(baseText);
    setBaseLabel(revisedLabel);
    setRevisedLabel(baseLabel);
    setChanges([]);
    setMessage('已交换两个版本，请重新运行比较。');
  }

  function runComparison() {
    if (!baseText.trim() || !revisedText.trim()) {
      setMessage('请先填写修改前和修改后两个版本。');
      return;
    }
    const nextChanges = compareRevisionTexts(baseText, revisedText);
    setChanges(nextChanges);
    setMessage(nextChanges.length
      ? `已生成 ${nextChanges.length} 项内容差异。请补充修改来源和原因。`
      : '两个版本没有发现内容差异；纯空格和换行变化不会单独列出。');
  }

  function updateChange(id: string, patch: Partial<RevisionChange>) {
    setChanges((current) => current.map((change) => change.id === id ? { ...change, ...patch } : change));
  }

  function saveComparison() {
    if (!project) return;
    if (!title.trim() || !baseText.trim() || !revisedText.trim()) {
      setMessage('保存前请填写比较名称和两个版本的正文。');
      return;
    }
    if (!changes.length && baseText.replace(/\s+/g, ' ').trim() !== revisedText.replace(/\s+/g, ' ').trim()) {
      setMessage('正文已经变化，请先运行版本比较再保存。');
      return;
    }
    const existing = project.revisionComparisons.find((item) => item.id === selectedId);
    const comparison = createRevisionComparison({
      id: existing?.id,
      title: title.trim(),
      chapterId: project.chapters.some((chapter) => chapter.id === chapterId) ? chapterId : undefined,
      baseLabel: baseLabel.trim() || '修改前',
      revisedLabel: revisedLabel.trim() || '修改后',
      baseText,
      revisedText,
      changes,
      createdAt: existing?.createdAt,
      updatedAt: new Date().toISOString(),
    });
    const comparisons = existing
      ? project.revisionComparisons.map((item) => item.id === existing.id ? comparison : item)
      : [comparison, ...project.revisionComparisons].slice(0, 20);
    commitProject({ ...project, revisionComparisons: comparisons });
    setSelectedId(comparison.id);
    setMessage(existing ? '版本比较和修改说明已更新。' : '版本比较已保存到论文项目。');
  }

  function removeComparison(comparison: RevisionComparison) {
    if (!project || !window.confirm(`删除“${comparison.title}”及其修改说明？`)) return;
    commitProject({ ...project, revisionComparisons: project.revisionComparisons.filter((item) => item.id !== comparison.id) });
    if (selectedId === comparison.id) resetEditor();
  }

  function currentComparison() {
    return createRevisionComparison({
      id: selectedId || undefined,
      title: title.trim() || '未命名版本比较',
      chapterId: project?.chapters.some((chapter) => chapter.id === chapterId) ? chapterId : undefined,
      baseLabel: baseLabel.trim() || '修改前',
      revisedLabel: revisedLabel.trim() || '修改后',
      baseText,
      revisedText,
      changes,
    });
  }

  if (!ready) return <div className="loading-state" role="status"><span className="spinner" /><strong>正在读取版本记录</strong></div>;

  if (!project) {
    return (
      <div className="project-empty compact-empty">
        <span className="eyebrow">版本比较与修改说明</span>
        <h1>先创建论文项目</h1>
        <p>版本记录保存在论文项目中，并可关联章节和导师意见。</p>
        <Link className="primary-link" href="/projects">创建论文项目</Link>
      </div>
    );
  }

  return (
    <div className="version-content">
      <div className={`save-indicator save-${saveState}`} aria-live="polite"><span aria-hidden="true" />{saveMessage}</div>
      <div className="page-heading project-heading">
        <div><span className="eyebrow">版本比较与修改说明 · v2.2</span><h1>不仅看见改了什么，也记录为什么改</h1></div>
        <p>比较在浏览器中完成。差异来源和修改原因由作者明确标记，系统不会把格式变化伪装成内容修改。</p>
      </div>

      {message ? <StatusBanner tone="neutral" title="版本比较提示">{message}</StatusBanner> : null}

      <div className="revision-layout">
        <aside className="revision-saved" aria-label="已保存的版本比较">
          <div><h2>已保存记录</h2><button onClick={resetEditor} type="button">新建比较</button></div>
          {project.revisionComparisons.length ? (
            <ul>{project.revisionComparisons.map((comparison) => <li key={comparison.id}><button className={selectedId === comparison.id ? 'selected' : ''} onClick={() => loadSaved(comparison)} type="button"><strong>{comparison.title}</strong><span>{comparison.changes.length} 项差异</span></button><button aria-label={`删除 ${comparison.title}`} className="danger-button" onClick={() => removeComparison(comparison)} type="button">删除</button></li>)}</ul>
          ) : <p>还没有保存的版本比较。</p>}
        </aside>

        <div className="revision-editor">
          <section className="project-section" aria-labelledby="revision-setup-title">
            <div className="project-section-heading"><div><span className="step-number">01</span><h2 id="revision-setup-title">准备两个版本</h2></div><button onClick={swapVersions} type="button">交换版本</button></div>
            <div className="form-grid two-columns">
              <label><span>比较名称</span><input maxLength={160} onChange={(event) => setTitle(event.target.value)} placeholder="例如：导师第一次修改后 · Discussion" value={title} /></label>
              <label><span>关联章节</span><select onChange={(event) => setChapterId(event.target.value)} value={chapterId}><option value="">暂不关联</option>{project.chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}</select></label>
              <label><span>基线版本名称</span><input maxLength={80} onChange={(event) => setBaseLabel(event.target.value)} value={baseLabel} /></label>
              <label><span>修改版本名称</span><input maxLength={80} onChange={(event) => setRevisedLabel(event.target.value)} value={revisedLabel} /></label>
            </div>
            <div className="revision-text-grid">
              <label><span>{baseLabel || '修改前'}</span><textarea aria-label="修改前版本" maxLength={12_000} onChange={(event) => { setBaseText(event.target.value); setChanges([]); }} placeholder="粘贴旧版本正文…" value={baseText} /></label>
              <label><span>{revisedLabel || '修改后'}</span><textarea aria-label="修改后版本" maxLength={12_000} onChange={(event) => { setRevisedText(event.target.value); setChanges([]); }} placeholder="粘贴新版本正文，或从项目章节载入…" value={revisedText} /></label>
            </div>
            <div className="revision-actions"><button disabled={!chapterId && !project.activeChapterId} onClick={loadChapterAsRevised} type="button">载入项目章节为修改后版本</button><button className="primary-button" disabled={!baseText.trim() || !revisedText.trim()} onClick={runComparison} type="button">运行本地比较</button></div>
          </section>

          <section className="project-section" aria-labelledby="revision-result-title">
            <div className="project-section-heading revision-result-heading"><div><span className="step-number">02</span><h2 id="revision-result-title">逐项填写修改说明</h2></div><div className="revision-counts"><span>新增 {counts.added}</span><span>删除 {counts.removed}</span><span>修改 {counts.modified}</span></div></div>
            {changes.length ? (
              <ol className="revision-change-list">
                {changes.map((change, index) => (
                  <li className={`revision-change revision-kind-${change.kind}`} key={change.id}>
                    <div className="revision-change-heading"><span>{KIND_LABELS[change.kind]}</span><strong>差异 {index + 1}</strong></div>
                    {change.before ? <div className="revision-fragment before"><small>修改前</small><p>{change.before}</p></div> : null}
                    {change.after ? <div className="revision-fragment after"><small>修改后</small><p>{change.after}</p></div> : null}
                    <div className="form-grid two-columns revision-change-fields">
                      <label><span>修改来源</span><select onChange={(event) => updateChange(change.id, { source: event.target.value as RevisionChangeSource })} value={change.source}>{Object.entries(SOURCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                      <label><span>关联导师意见</span><select onChange={(event) => updateChange(change.id, { feedbackId: event.target.value || undefined, ...(event.target.value ? { source: 'supervisor' as const } : {}) })} value={change.feedbackId || ''}><option value="">不关联</option>{project.supervisorFeedback.map((item) => <option key={item.id} value={item.id}>{item.comment.slice(0, 60)}</option>)}</select></label>
                      <label className="full-width"><span>修改原因或处理说明</span><textarea maxLength={1_500} onChange={(event) => updateChange(change.id, { reason: event.target.value })} placeholder="说明为什么修改，以及修改如何回应导师意见或解决表达问题。" value={change.reason} /></label>
                    </div>
                  </li>
                ))}
              </ol>
            ) : <div className="empty-state project-report-empty"><strong>尚未生成内容差异</strong><p>填写两个版本并运行本地比较。纯空格和换行变化会被忽略。</p></div>}
            <div className="revision-save-actions"><button disabled={!changes.length && !baseText.trim()} onClick={() => exportRevisionReport(project, currentComparison())} type="button">导出修改说明</button><button className="primary-button" disabled={!title.trim() || !baseText.trim() || !revisedText.trim()} onClick={saveComparison} type="button">保存到论文项目</button></div>
          </section>
        </div>
      </div>
    </div>
  );
}
