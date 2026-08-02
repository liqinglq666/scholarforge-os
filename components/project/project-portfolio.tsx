'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useWorkspace } from '@/components/workspace/use-workspace';
import { MAX_PROJECTS } from '@/lib/config';
import { createProjectFromPreferences } from '@/lib/project/create';
import { removeProject, upsertProject } from '@/lib/project/workspace';

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '时间未知' : date.toLocaleString('zh-CN');
}

export function ProjectPortfolio() {
  const router = useRouter();
  const { data, ready, saveState, saveMessage, replaceData, saveNow } = useWorkspace();

  function createProject() {
    if (data.projects.length >= MAX_PROJECTS) return;
    const project = createProjectFromPreferences(data.preferences, `论文项目 ${data.projects.length + 1}`);
    const next = upsertProject(data, project);
    replaceData(next);
    saveNow(next);
    router.push(`/projects/${project.id}`);
  }

  function deleteProject(projectId: string, name: string) {
    if (!window.confirm(`删除“${name || '未命名项目'}”及其章节、意见和版本记录？此操作无法撤销，建议先导出完整备份。`)) return;
    const next = removeProject(data, projectId);
    replaceData(next);
    saveNow(next);
  }

  if (!ready) return <div className="loading-state" role="status"><span className="spinner" /><strong>正在读取项目列表</strong></div>;

  return (
    <div className="project-portfolio">
      <div className={`save-indicator save-${saveState}`} aria-live="polite"><span aria-hidden="true" />{saveMessage}</div>
      <div className="page-heading portfolio-heading">
        <div><span className="eyebrow">我的项目</span><h1>每篇论文都有独立上下文</h1></div>
        <p>章节、目标期刊、术语、意见和版本记录不会再挤在一个全局项目里。旧版单项目数据会自动迁移为第一个项目。</p>
      </div>

      <div className="portfolio-actions">
        <button className="primary-button" disabled={data.projects.length >= MAX_PROJECTS} onClick={createProject} type="button">新建论文项目</button>
        <Link className="secondary-link" href="/settings">导入或导出完整备份</Link>
      </div>
      {data.projects.length >= MAX_PROJECTS ? <p className="portfolio-limit">本地项目已达到 {MAX_PROJECTS} 个上限。请先导出备份并删除不再使用的项目。</p> : null}

      {data.projects.length ? (
        <div className="project-card-grid">
          {data.projects.map((project) => {
            const filled = project.chapters.filter((chapter) => chapter.text.trim()).length;
            const unresolved = project.supervisorFeedback.filter((item) => item.status !== 'completed' && item.status !== 'not_adopted').length;
            return (
              <article className="project-card" key={project.id}>
                <div className="project-card-topline"><span>{project.targetJournal || '尚未设置目标期刊'}</span><time dateTime={project.updatedAt}>{formatDate(project.updatedAt)}</time></div>
                <h2><Link href={`/projects/${project.id}`}>{project.name || '未命名论文项目'}</Link></h2>
                <dl>
                  <div><dt>章节</dt><dd>{filled}/{project.chapters.length}</dd></div>
                  <div><dt>待处理意见</dt><dd>{unresolved}</dd></div>
                  <div><dt>版本</dt><dd>{project.revisionComparisons.length}</dd></div>
                </dl>
                <div className="project-card-actions">
                  <Link className="primary-link" href={`/projects/${project.id}`}>进入项目</Link>
                  <button className="danger-button" onClick={() => deleteProject(project.id, project.name)} type="button">删除</button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state large portfolio-empty">
          <strong>还没有论文项目</strong>
          <p>创建项目后，可以在同一上下文中管理章节、审校、意见、版本和一致性检查。</p>
          <button className="primary-button" onClick={createProject} type="button">创建第一个项目</button>
        </div>
      )}
    </div>
  );
}
