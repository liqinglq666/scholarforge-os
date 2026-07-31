'use client';

import { Icon } from '@/components/ui/icon';
import { SECTION_LABELS, WORKFLOW_DESCRIPTIONS, WORKFLOW_LABELS } from '@/lib/app-config';
import type { ReviewSnapshot, WorkspaceDraft } from '@/lib/workspace-schema';
import type { WorkspaceTask } from '@/lib/types';

interface ProjectHubProps {
  draft: WorkspaceDraft | null;
  history: ReviewSnapshot[];
  warnings: string[];
  serviceState: 'checking' | 'live' | 'demo' | 'offline';
  model: string;
  onCreate(task: WorkspaceTask): void;
  onImport(): void;
  onOpenDraft(): void;
  onOpenSnapshot(snapshot: ReviewSnapshot): void;
  onDeleteSnapshot(snapshot: ReviewSnapshot): void;
  onExportBackup(): void;
  onImportBackup(): void;
  onClearData(): void;
}

function formatDate(value?: string) {
  if (!value) return '尚未保存';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '时间未知';
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function pendingCount(snapshot: ReviewSnapshot) {
  return snapshot.result.issues.filter((issue) => (snapshot.decisions[issue.id] || 'pending') === 'pending').length;
}

const WORKFLOW_ORDER: WorkspaceTask[] = ['precheck', 'polish', 'translate', 'review-response'];

export function ProjectHub(props: ProjectHubProps) {
  const totalPending = props.history.reduce((sum, snapshot) => sum + pendingCount(snapshot), 0);
  const currentTask = props.draft?.taskType ? WORKFLOW_LABELS[props.draft.taskType] : '';
  const draftText = props.draft?.sourceText || '';

  return (
    <main className="sf-app-shell">
      <header className="sf-appbar">
        <a className="sf-brand" href="#main-content" aria-label="ScholarForge OS 研究项目中心">
          <span className="sf-brand-symbol">S</span>
          <span><strong>ScholarForge OS</strong><small>Evidence-first research writing</small></span>
        </a>
        <div className="sf-appbar-status">
          <span className={`sf-service-dot is-${props.serviceState}`} />
          <span>{props.serviceState === 'live' ? `${props.model} 已连接` : props.serviceState === 'demo' ? '安全演示模式' : props.serviceState === 'offline' ? '服务状态不可用' : '正在检查服务'}</span>
        </div>
      </header>

      <div className="sf-hub" id="main-content">
        <section className="sf-hub-heading">
          <div>
            <span className="sf-eyebrow">Research projects</span>
            <h1>研究项目</h1>
            <p>从论文文本到证据、作者决策和可交付文稿，所有关键状态都保留在同一项目中。</p>
          </div>
          <div className="sf-heading-actions">
            <button className="sf-button" onClick={props.onImport} type="button"><Icon name="import" /> 导入文档</button>
            <button className="sf-button is-primary" onClick={() => props.onCreate('precheck')} type="button"><Icon name="plus" /> 新建研究任务</button>
          </div>
        </section>

        {props.warnings.length ? <section className="sf-alert-stack" aria-live="polite">{props.warnings.map((warning) => <div className="sf-alert is-warning" key={warning}><Icon name="warning" />{warning}</div>)}</section> : null}

        {draftText.trim() ? (
          <section className="sf-resume-card">
            <div className="sf-resume-icon"><Icon name="edit" /></div>
            <div>
              <span>当前草稿</span>
              <h2>{props.draft?.projectTitle || '未命名科研写作任务'}</h2>
              <p>{currentTask} · {SECTION_LABELS[props.draft?.sectionType || 'general']} · {draftText.length.toLocaleString()} 字符</p>
            </div>
            <time>{formatDate(props.draft?.savedAt)}</time>
            <button className="sf-button is-primary" onClick={props.onOpenDraft} type="button">继续处理 <Icon name="arrow-right" /></button>
          </section>
        ) : null}

        {totalPending > 0 ? (
          <section className="sf-attention-strip">
            <span><Icon name="warning" /></span>
            <div><b>还有 {totalPending} 条证据等待作者决策</b><p>待处理建议不会自动写入文稿，也不会被批量应用。</p></div>
          </section>
        ) : null}

        <section className="sf-hub-section">
          <header className="sf-section-header">
            <div><span className="sf-eyebrow">Start a workflow</span><h2>新建任务</h2></div>
          </header>
          <div className="sf-workflow-list">
            {WORKFLOW_ORDER.map((task, index) => (
              <button key={task} onClick={() => props.onCreate(task)} type="button">
                <span className="sf-workflow-index">0{index + 1}</span>
                <div><b>{WORKFLOW_LABELS[task]}</b><p>{WORKFLOW_DESCRIPTIONS[task]}</p></div>
                <Icon name="arrow-right" />
              </button>
            ))}
          </div>
        </section>

        <section className="sf-hub-section">
          <header className="sf-section-header">
            <div><span className="sf-eyebrow">Recent work</span><h2>最近任务</h2></div>
            <span>{props.history.length} / 8</span>
          </header>

          {props.history.length ? (
            <div className="sf-project-table" role="table" aria-label="最近科研任务">
              <div className="sf-project-row is-head" role="row">
                <span role="columnheader">项目</span><span role="columnheader">工作流</span><span role="columnheader">准备度</span><span role="columnheader">待决策</span><span role="columnheader">修改时间</span><span aria-hidden="true" />
              </div>
              {props.history.map((snapshot) => {
                const pending = pendingCount(snapshot);
                return (
                  <article className="sf-project-row" key={snapshot.id} role="row">
                    <div role="cell"><b>{snapshot.projectTitle}</b><small>{snapshot.targetJournal || SECTION_LABELS[snapshot.sectionType]}</small></div>
                    <span role="cell">{WORKFLOW_LABELS[snapshot.taskType]}</span>
                    <span role="cell"><b>{snapshot.result.scoreAfter}</b><small>/100</small></span>
                    <span role="cell" className={pending ? 'is-pending' : 'is-complete'}>{pending ? `${pending} 条` : '已完成'}</span>
                    <time role="cell">{formatDate(snapshot.savedAt)}</time>
                    <div className="sf-row-actions" role="cell">
                      <button className="sf-button is-compact" onClick={() => props.onOpenSnapshot(snapshot)} type="button">打开</button>
                      <button aria-label={`删除 ${snapshot.projectTitle}`} className="sf-icon-button" onClick={() => props.onDeleteSnapshot(snapshot)} type="button"><Icon name="trash" size={16} /></button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="sf-empty-state"><span><Icon name="folder" size={24} /></span><h3>还没有任务历史</h3><p>创建任务或导入文档后，成功运行的审阅会出现在这里。</p></div>
          )}
        </section>

        <section className="sf-data-panel">
          <div><span className="sf-eyebrow">Local workspace</span><h2>数据与恢复</h2><p>草稿和最近 8 条历史保存在当前浏览器。可导出 JSON 备份，换设备前请主动保存。</p></div>
          <div>
            <button className="sf-button is-ghost" onClick={props.onExportBackup} type="button"><Icon name="download" /> 导出备份</button>
            <button className="sf-button is-ghost" onClick={props.onImportBackup} type="button"><Icon name="import" /> 恢复备份</button>
            <button className="sf-button is-danger-ghost" onClick={props.onClearData} type="button"><Icon name="trash" /> 清除本地数据</button>
          </div>
        </section>
      </div>
    </main>
  );
}
