'use client';

import { Icon } from '@/components/ui/icon';
import { SECTION_LABELS, WORKFLOW_LABELS } from '@/lib/app-config';
import type { ReviewSnapshot, WorkspaceDraft } from '@/lib/workspace-schema';
import type { WorkspaceTask } from '@/lib/types';

interface ProjectHubProps {
  draft: WorkspaceDraft | null;
  history: ReviewSnapshot[];
  warnings: string[];
  serviceState: 'checking' | 'ready' | 'unconfigured' | 'offline';
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
  return date.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function pendingCount(snapshot: ReviewSnapshot) {
  return snapshot.result.issues.filter((issue) => {
    const decision = snapshot.decisions[issue.id] || 'pending';
    return decision === 'pending' || decision === 'deferred';
  }).length;
}

function serviceLabel(state: ProjectHubProps['serviceState']) {
  if (state === 'ready') return '分析服务已就绪';
  if (state === 'unconfigured') return '分析服务未配置';
  if (state === 'offline') return '分析服务暂不可用';
  return '正在检查分析服务';
}

function serviceDotClass(state: ProjectHubProps['serviceState']) {
  if (state === 'ready') return 'is-live';
  if (state === 'offline') return 'is-offline';
  return '';
}

export function ProjectHub(props: ProjectHubProps) {
  const hasDraft = Boolean(props.draft?.sourceText?.trim());
  const recent = props.history.slice(0, 6);

  return (
    <main className="sf-home-shell">
      <header className="sf-home-header">
        <a className="sf-wordmark" href="#home-main" aria-label="ScholarForge OS 首页">
          <span className="sf-wordmark-mark">S</span>
          <span>
            <strong>ScholarForge</strong>
            <small>科研写作审阅</small>
          </span>
        </a>

        <details className="sf-home-menu">
          <summary aria-label="打开工作区菜单"><Icon name="more" /></summary>
          <div>
            <div className="sf-home-menu-status">
              <span className={`sf-service-dot ${serviceDotClass(props.serviceState)}`} />
              <span>{serviceLabel(props.serviceState)}</span>
            </div>
            <hr />
            <button onClick={props.onExportBackup} type="button"><Icon name="download" />导出本地备份</button>
            <button onClick={props.onImportBackup} type="button"><Icon name="import" />恢复本地备份</button>
            <hr />
            <button className="is-danger" onClick={props.onClearData} type="button"><Icon name="trash" />清除本地数据</button>
          </div>
        </details>
      </header>

      <div className="sf-home" id="home-main">
        {props.warnings.length ? (
          <div className="sf-home-alerts" aria-live="polite">
            {props.warnings.map((warning) => <div className="sf-alert is-warning" key={warning}><Icon name="warning" />{warning}</div>)}
          </div>
        ) : null}

        <section className="sf-start-panel">
          <div className="sf-start-copy">
            <span className="sf-kicker">Author-controlled research writing</span>
            <h1>从论文内容开始，<br />逐条做出可靠修改。</h1>
            <p>导入论文或粘贴一段文本。系统负责提出可追溯建议，是否接受、怎样修改始终由作者决定。</p>
          </div>

          <div className="sf-start-actions">
            <button className="sf-start-primary" onClick={props.onImport} type="button">
              <span><Icon name="import" size={22} /></span>
              <div><b>打开论文文件</b><small>支持 DOCX</small></div>
              <Icon name="arrow-right" />
            </button>
            <button className="sf-start-secondary" onClick={() => props.onCreate('precheck')} type="button">
              <span><Icon name="edit" size={20} /></span>
              <div><b>直接粘贴文本</b><small>适合处理单个论文段落</small></div>
              <Icon name="arrow-right" />
            </button>
          </div>
        </section>

        {hasDraft ? (
          <section className="sf-current-work">
            <header>
              <span className="sf-section-label">继续上次工作</span>
              <time>{formatDate(props.draft?.savedAt)}</time>
            </header>
            <button onClick={props.onOpenDraft} type="button">
              <div className="sf-file-symbol"><Icon name="document" size={22} /></div>
              <div>
                <h2>{props.draft?.projectTitle || '未命名科研写作任务'}</h2>
                <p>{WORKFLOW_LABELS[props.draft?.taskType || 'precheck']} · {SECTION_LABELS[props.draft?.sectionType || 'general']} · {(props.draft?.sourceText?.length || 0).toLocaleString()} 字符</p>
              </div>
              <span>继续</span>
              <Icon name="arrow-right" />
            </button>
          </section>
        ) : null}

        <section className="sf-recent-work">
          <header className="sf-home-section-header">
            <div>
              <span className="sf-section-label">最近任务</span>
              <h2>{recent.length ? '继续审阅或查看结果' : '你的任务会保存在这里'}</h2>
            </div>
            {recent.length ? <span>当前浏览器 · 最多 8 条</span> : null}
          </header>

          {recent.length ? (
            <div className="sf-recent-list">
              {recent.map((snapshot) => {
                const pending = pendingCount(snapshot);
                return (
                  <article key={snapshot.id}>
                    <button className="sf-recent-open" onClick={() => props.onOpenSnapshot(snapshot)} type="button">
                      <span className="sf-recent-type">{WORKFLOW_LABELS[snapshot.taskType].slice(0, 2)}</span>
                      <div>
                        <h3>{snapshot.projectTitle}</h3>
                        <p>{WORKFLOW_LABELS[snapshot.taskType]} · {SECTION_LABELS[snapshot.sectionType]} · {formatDate(snapshot.savedAt)}</p>
                      </div>
                      <span className={pending ? 'sf-task-state is-pending' : 'sf-task-state is-done'}>{pending ? `${pending} 条待处理` : '已完成决策'}</span>
                      <Icon name="arrow-right" />
                    </button>
                    <button aria-label={`删除 ${snapshot.projectTitle}`} className="sf-recent-delete" onClick={() => props.onDeleteSnapshot(snapshot)} type="button"><Icon name="trash" size={16} /></button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="sf-empty-home">
              <span><Icon name="folder" size={24} /></span>
              <h3>还没有审阅记录</h3>
              <p>打开论文或粘贴文本，完成第一次分析后即可从这里继续。</p>
            </div>
          )}
        </section>

        <footer className="sf-home-footer">
          <span><Icon name="shield" size={15} /> 原始文件在浏览器本地解析</span>
          <span>建议不会自动写入论文</span>
        </footer>
      </div>
    </main>
  );
}
