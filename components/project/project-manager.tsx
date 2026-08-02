'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StatusBanner } from '@/components/feedback/status-banner';
import { useWorkspace } from '@/components/workspace/use-workspace';
import {
  MAX_HISTORY_ENTRIES,
  MAX_SOURCE_CHARACTERS,
  SECTION_OPTIONS,
  TASK_DESCRIPTIONS,
  TASK_LABELS,
} from '@/lib/config';
import { analyzeProjectConsistency } from '@/lib/project/consistency';
import type {
  ConsistencyIssue,
  ManuscriptChapter,
  ManuscriptProject,
  SectionType,
  TaskType,
  TerminologyLock,
} from '@/lib/types';
import {
  createDraft,
  createHistoryEntry,
  createManuscriptChapter,
  createManuscriptProject,
  createWorkspaceState,
} from '@/lib/workspace/schema';

const TASKS = Object.keys(TASK_LABELS) as TaskType[];

function formatDate(value?: string) {
  if (!value) return '尚未从工作台保存';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '时间未知' : date.toLocaleString('zh-CN');
}

export function ProjectManager() {
  const router = useRouter();
  const { data, ready, saveState, saveMessage, replaceData, saveNow } = useWorkspace();
  const [termSource, setTermSource] = useState('');
  const [termPreferred, setTermPreferred] = useState('');
  const [report, setReport] = useState<ConsistencyIssue[] | null>(null);
  const project = data.project || null;
  const activeChapter = useMemo(() => {
    if (!project) return null;
    return project.chapters.find((chapter) => chapter.id === project.activeChapterId) || project.chapters[0] || null;
  }, [project]);

  function commitProject(nextProject: ManuscriptProject) {
    const nextData = { ...data, project: { ...nextProject, updatedAt: new Date().toISOString() }, updatedAt: new Date().toISOString() };
    replaceData(nextData);
    setReport(null);
  }

  function createProject() {
    const nextProject = createManuscriptProject({ name: '我的论文项目' });
    const nextData = { ...data, project: nextProject, updatedAt: new Date().toISOString() };
    replaceData(nextData);
    saveNow(nextData);
  }

  function updateProject(patch: Partial<ManuscriptProject>) {
    if (!project) return;
    commitProject({ ...project, ...patch });
  }

  function updateChapter(chapterId: string, patch: Partial<ManuscriptChapter>) {
    if (!project) return;
    commitProject({
      ...project,
      chapters: project.chapters.map((chapter) => chapter.id === chapterId
        ? { ...chapter, ...patch, updatedAt: new Date().toISOString() }
        : chapter),
    });
  }

  function addChapter() {
    if (!project || project.chapters.length >= 12) return;
    const chapter = createManuscriptChapter({ title: `章节 ${project.chapters.length + 1}` });
    commitProject({ ...project, chapters: [...project.chapters, chapter], activeChapterId: chapter.id });
  }

  function removeChapter(chapter: ManuscriptChapter) {
    if (!project || project.chapters.length <= 1) return;
    if (!window.confirm(`删除“${chapter.title}”？该章节文本会从本地论文项目中移除，建议先导出工作区备份。`)) return;
    const chapters = project.chapters.filter((item) => item.id !== chapter.id);
    commitProject({ ...project, chapters, activeChapterId: chapters[0]?.id });
  }

  function addTerm() {
    if (!project) return;
    const source = termSource.trim();
    const preferred = termPreferred.trim();
    if (!source || !preferred || project.terminologyLocks.length >= 20) return;
    if (project.terminologyLocks.some((item) => item.source.toLocaleLowerCase() === source.toLocaleLowerCase())) return;
    const term: TerminologyLock = { id: crypto.randomUUID(), source, preferred };
    commitProject({ ...project, terminologyLocks: [...project.terminologyLocks, term] });
    setTermSource('');
    setTermPreferred('');
  }

  function removeTerm(id: string) {
    if (!project) return;
    commitProject({ ...project, terminologyLocks: project.terminologyLocks.filter((item) => item.id !== id) });
  }

  function openChapterInWorkspace(chapter: ManuscriptChapter) {
    if (!project) return;
    if (chapter.text.trim().length < 40) {
      window.alert('章节正文至少需要 40 个字符，才能进入审校工作台。');
      return;
    }
    const hasCurrentWork = Boolean(data.current.currentResult || data.current.draft.sourceText.trim());
    if (hasCurrentWork && !window.confirm('打开本章节会替换当前审校工作台。当前草稿或结果会先保存到最近任务。确定继续吗？')) return;
    const preserved = hasCurrentWork ? createHistoryEntry(data.current) : null;
    const history = [
      ...(preserved ? [preserved] : []),
      ...data.history.filter((item) => item.id !== preserved?.id),
    ].slice(0, MAX_HISTORY_ENTRIES);
    const draft = createDraft({
      projectName: project.name || chapter.title,
      taskType: chapter.taskType,
      sectionType: chapter.sectionType,
      targetJournal: project.targetJournal,
      sourceText: chapter.text,
      terminologyLocks: project.terminologyLocks.map((item) => ({ ...item })),
      linkedProjectId: project.id,
      linkedChapterId: chapter.id,
    });
    const nextProject = { ...project, activeChapterId: chapter.id, updatedAt: new Date().toISOString() };
    const nextData = {
      ...data,
      current: createWorkspaceState(draft),
      history,
      project: nextProject,
      updatedAt: new Date().toISOString(),
    };
    replaceData(nextData);
    saveNow(nextData);
    router.push('/workspace');
  }

  function runConsistencyCheck() {
    if (!project) return;
    setReport(analyzeProjectConsistency(project));
  }

  if (!ready) return <div className="loading-state" role="status"><span className="spinner" /><strong>正在读取论文项目</strong></div>;

  if (!project) {
    return (
      <div className="project-empty">
        <span className="eyebrow">论文项目 · v2.1</span>
        <h1>把多个章节放在同一个可恢复的工作区</h1>
        <p>项目用于共享目标期刊和术语库，并在摘要、方法、结果、讨论与结论之间运行确定性一致性检查。章节不会被自动发送给模型。</p>
        <button className="primary-button" onClick={createProject} type="button">创建本地论文项目</button>
      </div>
    );
  }

  return (
    <div className="project-content">
      <div className={`save-indicator save-${saveState}`} aria-live="polite"><span aria-hidden="true" />{saveMessage}</div>
      <div className="page-heading project-heading">
        <div><span className="eyebrow">论文项目 · 多章节工作区</span><h1>{project.name || '未命名论文项目'}</h1></div>
        <p>所有章节保存在当前浏览器。只有你把某一章节明确打开到审校工作台并确认分析后，该章节文本才会发送给模型。</p>
      </div>

      <section className="project-metadata" aria-labelledby="project-meta-title">
        <div><span className="step-number">01</span><h2 id="project-meta-title">项目设置</h2></div>
        <div className="form-grid two-columns">
          <label><span>论文或课题名称</span><input maxLength={120} onChange={(event) => updateProject({ name: event.target.value })} value={project.name} /></label>
          <label><span>目标期刊（可选）</span><input maxLength={160} onChange={(event) => updateProject({ targetJournal: event.target.value })} placeholder="只作为写作语境，不自动获取期刊规则" value={project.targetJournal} /></label>
        </div>
      </section>

      <div className="project-grid">
        <aside className="chapter-sidebar" aria-label="项目章节">
          <div className="chapter-sidebar-heading"><div><span className="step-number">02</span><h2>章节</h2></div><button disabled={project.chapters.length >= 12} onClick={addChapter} type="button">添加章节</button></div>
          <div className="chapter-list" role="list">
            {project.chapters.map((chapter) => (
              <button
                aria-current={chapter.id === activeChapter?.id ? 'true' : undefined}
                className={chapter.id === activeChapter?.id ? 'selected' : ''}
                key={chapter.id}
                onClick={() => updateProject({ activeChapterId: chapter.id })}
                role="listitem"
                type="button"
              >
                <strong>{chapter.title}</strong>
                <span>{chapter.text.length.toLocaleString()} 字符 · {chapter.lastReviewedAt ? '已回写' : '未回写'}</span>
              </button>
            ))}
          </div>
          <small>最多 12 个章节。建议按摘要、引言、方法、结果、讨论和结论组织。</small>
        </aside>

        {activeChapter ? (
          <section className="chapter-editor" aria-labelledby="chapter-editor-title">
            <div className="chapter-editor-heading">
              <div><span className="step-number">03</span><h2 id="chapter-editor-title">编辑当前章节</h2></div>
              <button className="danger-button" disabled={project.chapters.length <= 1} onClick={() => removeChapter(activeChapter)} type="button">删除章节</button>
            </div>
            <div className="form-grid two-columns">
              <label><span>章节名称</span><input maxLength={120} onChange={(event) => updateChapter(activeChapter.id, { title: event.target.value })} value={activeChapter.title} /></label>
              <label><span>章节类型</span><select onChange={(event) => updateChapter(activeChapter.id, { sectionType: event.target.value as SectionType })} value={activeChapter.sectionType}>{SECTION_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="full-width"><span>进入工作台时使用的任务</span><select onChange={(event) => updateChapter(activeChapter.id, { taskType: event.target.value as TaskType })} value={activeChapter.taskType}>{TASKS.map((task) => <option key={task} value={task}>{TASK_LABELS[task]}：{TASK_DESCRIPTIONS[task]}</option>)}</select></label>
            </div>
            <label className="source-field project-source" htmlFor={`chapter-${activeChapter.id}`}>
              <span>章节正文</span>
              <textarea id={`chapter-${activeChapter.id}`} maxLength={MAX_SOURCE_CHARACTERS} onChange={(event) => updateChapter(activeChapter.id, { text: event.target.value })} placeholder="粘贴本章节正文。每个章节最多 12,000 个字符。" value={activeChapter.text} />
            </label>
            <div className="chapter-footer">
              <span>{activeChapter.text.length.toLocaleString()} / {MAX_SOURCE_CHARACTERS.toLocaleString()} 字符 · 最近回写：{formatDate(activeChapter.lastReviewedAt)}</span>
              <button className="primary-button" disabled={activeChapter.text.trim().length < 40} onClick={() => openChapterInWorkspace(activeChapter)} type="button">在审校工作台打开</button>
            </div>
          </section>
        ) : null}
      </div>

      <section className="project-section" aria-labelledby="project-terms-title">
        <div className="project-section-heading"><div><span className="step-number">04</span><h2 id="project-terms-title">项目术语与缩写库</h2></div><p>打开任一章节到工作台时自动带入，所有章节共享。</p></div>
        <div className="term-entry">
          <label><span>原词或非首选表达</span><input maxLength={120} onChange={(event) => setTermSource(event.target.value)} placeholder="例如：neural net" value={termSource} /></label>
          <label><span>指定表达</span><input maxLength={160} onChange={(event) => setTermPreferred(event.target.value)} placeholder="例如：neural network (NN)" value={termPreferred} /></label>
          <button disabled={!termSource.trim() || !termPreferred.trim() || project.terminologyLocks.length >= 20} onClick={addTerm} type="button">添加术语</button>
        </div>
        {project.terminologyLocks.length ? (
          <ul className="term-list">{project.terminologyLocks.map((term) => <li key={term.id}><span><b>{term.source}</b><small>统一使用：{term.preferred}</small></span><button aria-label={`删除术语 ${term.source}`} onClick={() => removeTerm(term.id)} type="button">删除</button></li>)}</ul>
        ) : <p className="empty-inline">尚未建立项目术语库。建议先加入核心变量、材料名称、量表名称、模型名称和缩写。</p>}
      </section>

      <section className="project-section" aria-labelledby="consistency-title">
        <div className="project-section-heading">
          <div><span className="step-number">05</span><h2 id="consistency-title">跨章节一致性检查</h2></div>
          <button className="primary-button" onClick={runConsistencyCheck} type="button">运行本地检查</button>
        </div>
        <p className="project-help">检查在浏览器中运行，不调用模型。目前核对样本量候选、带单位指标、缩写定义和项目术语。结果只提示冲突位置，不自动决定哪个版本正确。</p>
        {report ? (
          report.length ? (
            <div className="consistency-list">
              {report.map((issue) => (
                <article className={`consistency-card severity-card-${issue.severity}`} key={issue.id}>
                  <div><span className={`severity severity-${issue.severity}`}>{issue.severity === 'major' ? '重大' : issue.severity === 'minor' ? '一般' : '建议'}</span><strong>{issue.title}</strong></div>
                  <p>{issue.description}</p>
                  {issue.occurrences.length ? <ul>{issue.occurrences.map((item, index) => <li key={`${item.chapterId}-${index}`}><b>{item.chapterTitle}</b><span>{item.excerpt}</span></li>)}</ul> : null}
                </article>
              ))}
            </div>
          ) : <StatusBanner tone="success" title="未发现当前规则覆盖的跨章节冲突">这不代表论文完全一致。仍需人工核对统计口径、图表、引用、方法和结论。</StatusBanner>
        ) : <div className="empty-state project-report-empty"><strong>尚未运行检查</strong><p>至少填写两个章节后运行，结果更有价值。</p></div>}
      </section>
    </div>
  );
}
