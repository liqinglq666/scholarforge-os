'use client';

import Link from 'next/link';
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
import { getProject, upsertProject } from '@/lib/project/workspace';
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
  createWorkspaceState,
} from '@/lib/workspace/schema';

const TASKS = Object.keys(TASK_LABELS) as TaskType[];

function formatDate(value?: string) {
  if (!value) return '尚未审校';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '时间未知' : date.toLocaleString('zh-CN');
}

function mergeTerminologyLocks(projectLocks: TerminologyLock[], personalLocks: TerminologyLock[]) {
  const seen = new Set<string>();
  return [...projectLocks, ...personalLocks].flatMap((item) => {
    const key = item.source.toLocaleLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ ...item, id: crypto.randomUUID() }];
  }).slice(0, 20);
}

export function ProjectManager({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { data, ready, saveState, saveMessage, replaceData, saveNow } = useWorkspace();
  const [termSource, setTermSource] = useState('');
  const [termPreferred, setTermPreferred] = useState('');
  const [report, setReport] = useState<ConsistencyIssue[] | null>(null);
  const [reviewTask, setReviewTask] = useState<TaskType>(data.preferences.defaultTaskType);
  const project = getProject(data, projectId);
  const activeChapter = useMemo(() => {
    if (!project) return null;
    return project.chapters.find((chapter) => chapter.id === project.activeChapterId) || project.chapters[0] || null;
  }, [project]);

  function commitProject(nextProject: ManuscriptProject) {
    const nextData = upsertProject(data, { ...nextProject, updatedAt: new Date().toISOString() });
    replaceData(nextData);
    setReport(null);
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
    const chapter = createManuscriptChapter({
      title: `章节 ${project.chapters.length + 1}`,
      sectionType: data.preferences.defaultSectionType,
    });
    commitProject({ ...project, chapters: [...project.chapters, chapter], activeChapterId: chapter.id });
  }

  function removeChapter(chapter: ManuscriptChapter) {
    if (!project || project.chapters.length <= 1) return;
    if (!window.confirm(`删除“${chapter.title}”？该章节文本和关联记录会从本地项目中移除，建议先导出备份。`)) return;
    const chapters = project.chapters.filter((item) => item.id !== chapter.id);
    commitProject({
      ...project,
      chapters,
      activeChapterId: chapters[0]?.id,
      supervisorFeedback: project.supervisorFeedback.map((item) => item.chapterId === chapter.id ? { ...item, chapterId: undefined } : item),
      revisionComparisons: project.revisionComparisons.filter((item) => item.chapterId !== chapter.id),
    });
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
      window.alert('章节正文至少需要 40 个字符，才能进入审校。');
      return;
    }
    const hasCurrentWork = Boolean(data.current.currentResult || data.current.draft.sourceText.trim());
    if (hasCurrentWork && !window.confirm('打开本章节会替换当前快速审校内容。当前草稿或结果会先保留到本地历史。确定继续吗？')) return;
    const preserved = hasCurrentWork ? createHistoryEntry(data.current) : null;
    const history = [
      ...(preserved ? [preserved] : []),
      ...data.history.filter((item) => item.id !== preserved?.id),
    ].slice(0, MAX_HISTORY_ENTRIES);
    const draft = createDraft({
      projectName: project.name || chapter.title,
      taskType: reviewTask,
      sectionType: chapter.sectionType,
      targetJournal: project.targetJournal,
      sourceText: chapter.text,
      terminologyLocks: mergeTerminologyLocks(project.terminologyLocks, data.preferences.customWritingRules),
      linkedProjectId: project.id,
      linkedChapterId: chapter.id,
    });
    const nextProject = { ...project, activeChapterId: chapter.id, updatedAt: new Date().toISOString() };
    const nextData = upsertProject({
      ...data,
      current: createWorkspaceState(draft),
      history,
      updatedAt: new Date().toISOString(),
    }, nextProject);
    replaceData(nextData);
    saveNow(nextData);
    router.push(`/projects/${project.id}/review`);
  }

  function runConsistencyCheck() {
    if (!project) return;
    setReport(analyzeProjectConsistency(project));
  }

  if (!ready) return <div className="loading-state" role="status"><span className="spinner" /><strong>正在读取论文项目</strong></div>;

  if (!project) {
    return (
      <div className="project-empty compact-empty">
        <span className="eyebrow">项目不存在或已删除</span>
        <h1>返回项目列表继续工作</h1>
        <p>当前链接指向的项目不在此浏览器中。可以选择已有项目，或创建一个新项目。</p>
        <Link className="primary-link" href="/projects">查看我的项目</Link>
      </div>
    );
  }

  const completedFeedback = project.supervisorFeedback.filter((item) => item.status === 'completed').length;
  const filledChapters = project.chapters.filter((chapter) => chapter.text.trim()).length;
  const reviewedChapters = project.chapters.filter((chapter) => chapter.lastReviewedAt).length;

  return (
    <div className="project-content">
      <div className={`save-indicator save-${saveState}`} aria-live="polite"><span aria-hidden="true" />{saveMessage}</div>
      <div className="page-heading project-heading">
        <div><span className="eyebrow">项目工作区</span><h1>{project.name || '未命名论文项目'}</h1></div>
        <p>章节、意见、版本与一致性检查属于同一个项目。只有你明确打开的章节会进入审校流程。</p>
      </div>

      <section className="project-overview" aria-label="项目进度">
        <article><strong>{filledChapters}/{project.chapters.length}</strong><span>已填写章节</span></article>
        <article><strong>{reviewedChapters}</strong><span>已审校章节</span></article>
        <article><strong>{project.supervisorFeedback.length - completedFeedback}</strong><span>待处理意见</span></article>
        <article><strong>{project.revisionComparisons.length}</strong><span>版本记录</span></article>
      </section>

      <section className="project-metadata" aria-labelledby="project-meta-title">
        <div><h2 id="project-meta-title">项目信息</h2></div>
        <div className="form-grid two-columns">
          <label><span>论文或课题名称</span><input maxLength={120} onChange={(event) => updateProject({ name: event.target.value })} value={project.name} /></label>
          <label><span>目标期刊（可选）</span><input maxLength={160} onChange={(event) => updateProject({ targetJournal: event.target.value })} placeholder="仅作为写作语境，不自动获取期刊规则" value={project.targetJournal} /></label>
        </div>
      </section>

      <div className="project-grid">
        <aside className="chapter-sidebar" aria-label="项目章节">
          <div className="chapter-sidebar-heading"><div><h2>章节</h2></div><button disabled={project.chapters.length >= 12} onClick={addChapter} type="button">添加章节</button></div>
          <ul className="chapter-list">
            {project.chapters.map((chapter) => (
              <li key={chapter.id}>
                <button
                  aria-current={chapter.id === activeChapter?.id ? 'true' : undefined}
                  className={chapter.id === activeChapter?.id ? 'selected' : ''}
                  onClick={() => updateProject({ activeChapterId: chapter.id })}
                  type="button"
                >
                  <strong>{chapter.title}</strong>
                  <span>{chapter.text.length.toLocaleString()} 字符 · {chapter.lastReviewedAt ? '已审校' : '未审校'}</span>
                </button>
              </li>
            ))}
          </ul>
          <small>章节只描述论文结构；翻译、润色或投稿前检查在每次开始审校时选择。</small>
        </aside>

        {activeChapter ? (
          <section className="chapter-editor" aria-labelledby="chapter-editor-title">
            <div className="chapter-editor-heading">
              <div><h2 id="chapter-editor-title">{activeChapter.title}</h2></div>
              <button className="danger-button" disabled={project.chapters.length <= 1} onClick={() => removeChapter(activeChapter)} type="button">删除章节</button>
            </div>
            <div className="form-grid two-columns">
              <label><span>章节名称</span><input maxLength={120} onChange={(event) => updateChapter(activeChapter.id, { title: event.target.value })} value={activeChapter.title} /></label>
              <label><span>章节类型</span><select onChange={(event) => updateChapter(activeChapter.id, { sectionType: event.target.value as SectionType })} value={activeChapter.sectionType}>{SECTION_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            </div>
            <label className="source-field project-source" htmlFor={`chapter-${activeChapter.id}`}>
              <span>章节正文</span>
              <textarea id={`chapter-${activeChapter.id}`} maxLength={MAX_SOURCE_CHARACTERS} onChange={(event) => updateChapter(activeChapter.id, { text: event.target.value })} placeholder="粘贴本章节正文。每个章节最多 12,000 个字符。" value={activeChapter.text} />
            </label>
            <div className="chapter-review-launcher">
              <label><span>本次要做什么</span><select onChange={(event) => setReviewTask(event.target.value as TaskType)} value={reviewTask}>{TASKS.map((task) => <option key={task} value={task}>{TASK_LABELS[task]}：{TASK_DESCRIPTIONS[task]}</option>)}</select></label>
              <button className="primary-button" disabled={activeChapter.text.trim().length < 40} onClick={() => openChapterInWorkspace(activeChapter)} type="button">开始本章节审校</button>
            </div>
            <div className="chapter-footer"><span>{activeChapter.text.length.toLocaleString()} / {MAX_SOURCE_CHARACTERS.toLocaleString()} 字符 · 最近审校：{formatDate(activeChapter.lastReviewedAt)}</span></div>
          </section>
        ) : null}
      </div>

      <section className="project-section" aria-labelledby="project-terms-title">
        <div className="project-section-heading"><div><h2 id="project-terms-title">项目术语库</h2></div><p>与个人规则合并后用于本项目的每次审校；项目规则优先。</p></div>
        <div className="term-entry">
          <label><span>原词或非首选表达</span><input maxLength={120} onChange={(event) => setTermSource(event.target.value)} placeholder="例如：neural net" value={termSource} /></label>
          <label><span>指定表达</span><input maxLength={160} onChange={(event) => setTermPreferred(event.target.value)} placeholder="例如：neural network (NN)" value={termPreferred} /></label>
          <button disabled={!termSource.trim() || !termPreferred.trim() || project.terminologyLocks.length >= 20} onClick={addTerm} type="button">添加术语</button>
        </div>
        {project.terminologyLocks.length ? (
          <ul className="term-list">{project.terminologyLocks.map((term) => <li key={term.id}><span><b>{term.source}</b><small>统一使用：{term.preferred}</small></span><button aria-label={`删除术语 ${term.source}`} onClick={() => removeTerm(term.id)} type="button">删除</button></li>)}</ul>
        ) : <p className="empty-inline">尚未建立项目术语库。个人规则仍会自动带入。</p>}
      </section>

      <section className="project-section" aria-labelledby="consistency-title">
        <div className="project-section-heading">
          <div><h2 id="consistency-title">跨章节一致性</h2></div>
          <button className="primary-button" onClick={runConsistencyCheck} type="button">运行本地检查</button>
        </div>
        <p className="project-help">在浏览器中核对样本量候选、带单位指标、缩写定义和项目术语，不调用模型。</p>
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
          ) : <StatusBanner tone="success" title="未发现当前规则覆盖的跨章节冲突">仍需人工核对统计口径、图表、引用、方法和结论。</StatusBanner>
        ) : <div className="empty-state project-report-empty"><strong>尚未运行检查</strong><p>至少填写两个章节后运行，结果更有价值。</p></div>}
      </section>
    </div>
  );
}
