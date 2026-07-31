'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import {
  deleteCloudProject,
  isMissingCloudSchema,
  listCloudProjects,
  projectKeyFromDraft,
  readLocalWorkspace,
  syncAllLocalProjects,
  syncCurrentLocalProject,
  writeLocalWorkspace,
  type CloudProject,
} from '@/lib/cloud-workspace';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

const HUB_VIEW_KEY = 'scholarforge-os-hub-view-v1';

type CloudState = 'idle' | 'loading' | 'ready' | 'error' | 'schema-missing';

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '时间未知';
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function localProjectCount() {
  const local = readLocalWorkspace();
  const keys = new Set<string>();
  if (local.draft) keys.add(projectKeyFromDraft(local.draft));
  for (const snapshot of local.history) keys.add(projectKeyFromDraft(snapshot));
  return keys.size;
}

export function CloudWorkspaceDock() {
  const { user, supabaseConfigured } = useAuth();
  const client = useMemo(() => getSupabaseBrowserClient(), []);
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<CloudProject[]>([]);
  const [state, setState] = useState<CloudState>('idle');
  const [message, setMessage] = useState('');
  const [localCount, setLocalCount] = useState(0);

  const cloudEnabled = Boolean(user?.mode === 'supabase' && client);

  const refreshLocalCount = useCallback(() => {
    setLocalCount(localProjectCount());
  }, []);

  const loadProjects = useCallback(async (clearMessage = true) => {
    if (!client || user?.mode !== 'supabase') return false;
    setState('loading');
    if (clearMessage) setMessage('');
    try {
      const next = await listCloudProjects(client, user.id);
      setProjects(next);
      setState('ready');
      return true;
    } catch (error) {
      if (isMissingCloudSchema(error)) {
        setState('schema-missing');
        setMessage('Supabase 已连接，但云端项目数据表尚未部署。');
      } else {
        setState('error');
        setMessage(error instanceof Error ? error.message : '读取云端项目失败。');
      }
      return false;
    }
  }, [client, user]);

  useEffect(() => {
    refreshLocalCount();
  }, [refreshLocalCount]);

  useEffect(() => {
    if (!open) return;
    refreshLocalCount();
    if (cloudEnabled) void loadProjects();
  }, [cloudEnabled, loadProjects, open, refreshLocalCount]);

  async function runSync(kind: 'current' | 'all') {
    if (!client || user?.mode !== 'supabase') return;
    setState('loading');
    setMessage('');
    try {
      const synced = kind === 'current'
        ? [await syncCurrentLocalProject(client, user.id)]
        : await syncAllLocalProjects(client, user.id);
      refreshLocalCount();
      const refreshed = await loadProjects(false);
      if (refreshed) {
        setMessage(kind === 'current'
          ? `“${synced[0].title}”已同步到云端。`
          : `已迁移 ${synced.length} 个本机项目到云端。`);
      }
    } catch (error) {
      if (isMissingCloudSchema(error)) {
        setState('schema-missing');
        setMessage('需要先在 Supabase SQL Editor 中运行仓库提供的云端项目迁移脚本。');
      } else {
        setState('error');
        setMessage(error instanceof Error ? error.message : '云端同步失败。');
      }
    }
  }

  function restoreProject(project: CloudProject) {
    const confirmed = window.confirm(`将云端项目“${project.title}”恢复到当前浏览器，并覆盖本地草稿与最近任务历史，是否继续？`);
    if (!confirmed) return;
    writeLocalWorkspace(project.workspace);
    window.sessionStorage.setItem(HUB_VIEW_KEY, 'workspace');
    window.location.reload();
  }

  async function removeProject(project: CloudProject) {
    if (!client || user?.mode !== 'supabase') return;
    const confirmed = window.confirm(`确定删除云端项目“${project.title}”吗？此操作不会删除本机副本，但无法撤销。`);
    if (!confirmed) return;
    setState('loading');
    setMessage('');
    try {
      await deleteCloudProject(client, user.id, project.id);
      const refreshed = await loadProjects(false);
      if (refreshed) setMessage(`云端项目“${project.title}”已删除。`);
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : '删除云端项目失败。');
    }
  }

  if (!user) return null;

  const modeLabel = user.mode === 'supabase' ? 'Supabase 云端账户' : '访客模式';

  return <div className={`cloud-dock ${open ? 'is-open' : ''}`}>
    <button
      aria-expanded={open}
      aria-haspopup="dialog"
      className="cloud-dock-trigger"
      onClick={() => setOpen((value) => !value)}
      type="button"
    >
      <span aria-hidden="true">☁</span>
      <span><b>云端项目</b><small>{cloudEnabled ? `${projects.length} 个项目` : '本地模式'}</small></span>
      {cloudEnabled && projects.length ? <i>{projects.length}</i> : null}
    </button>

    {open ? <aside aria-label="云端论文项目" className="cloud-dock-panel" role="dialog">
      <header>
        <div><span>Cloud workspace</span><h2>云端论文项目</h2><p>{modeLabel}</p></div>
        <button aria-label="关闭云端项目面板" onClick={() => setOpen(false)} type="button">×</button>
      </header>

      {!supabaseConfigured ? <section className="cloud-state-card is-local">
        <span>本地</span>
        <h3>Supabase 尚未配置</h3>
        <p>当前草稿和任务历史继续保存在此浏览器。配置 Supabase 后即可启用真实邮箱账户与跨设备项目。</p>
        <a href="https://github.com/liqinglq666/scholarforge-os/blob/main/docs/cloud-workspace.md" rel="noreferrer" target="_blank">查看配置文档 ↗</a>
      </section> : null}

      {supabaseConfigured && user.mode === 'guest' ? <section className="cloud-state-card is-local">
        <span>账户</span>
        <h3>访客会话没有云端项目</h3>
        <p>访客继续使用浏览器存储。登录 Supabase 邮箱账户后，才能访问按用户隔离的云端项目。</p>
        <a href="/login">登录云端账户 →</a>
      </section> : null}

      {cloudEnabled ? <>
        <section className="cloud-sync-card">
          <div><span>Local → Cloud</span><h3>迁移本机工作区</h3><p>同步只会在你点击后发生，不会后台自动上传论文文本。</p></div>
          <div className="cloud-sync-metrics"><span><b>{localCount}</b> 本机项目</span><span><b>{projects.length}</b> 云端项目</span></div>
          <div className="cloud-sync-actions">
            <button disabled={state === 'loading' || localCount === 0} onClick={() => void runSync('current')} type="button">同步当前项目</button>
            <button disabled={state === 'loading' || localCount === 0} onClick={() => void runSync('all')} type="button">迁移全部本机项目</button>
          </div>
        </section>

        {state === 'schema-missing' ? <section className="cloud-state-card is-warning">
          <span>Setup required</span>
          <h3>云端数据表尚未部署</h3>
          <p>{message}</p>
          <a href="https://github.com/liqinglq666/scholarforge-os/blob/main/supabase/migrations/20260730_cloud_workspace.sql" rel="noreferrer" target="_blank">打开 SQL 迁移脚本 ↗</a>
        </section> : null}

        {state !== 'schema-missing' ? <section className="cloud-project-section">
          <div className="cloud-section-head"><div><span>Private projects</span><h3>你的云端项目</h3></div><button disabled={state === 'loading'} onClick={() => void loadProjects()} type="button">刷新</button></div>
          {state === 'loading' && !projects.length ? <div className="cloud-loading"><i />正在读取云端项目…</div> : null}
          {projects.length ? <div className="cloud-project-list">{projects.map((project) => <article key={project.id}>
            <header><span>{project.taskType}</span><time>{formatDate(project.updatedAt)}</time></header>
            <h4>{project.title}</h4>
            <p>{project.targetJournal || '未指定目标期刊'}</p>
            <div><span>{project.latestScore === null ? '—' : project.latestScore}<small>/100</small></span><span>{project.pendingCount}<small>待处理</small></span><span>{project.workspace.history.length}<small>快照</small></span></div>
            <footer><button onClick={() => restoreProject(project)} type="button">恢复到工作台</button><button aria-label={`删除 ${project.title}`} onClick={() => void removeProject(project)} type="button">删除</button></footer>
          </article>)}</div> : state === 'ready' ? <div className="cloud-empty"><span>☁</span><b>还没有云端项目</b><p>先同步当前草稿，或一次迁移全部本机任务。</p></div> : null}
        </section> : null}
      </> : null}

      {message && state !== 'schema-missing' ? <div className={`cloud-message is-${state}`} role="status">{message}</div> : null}

      <footer>
        <span>每条云端记录都由 Supabase RLS 按用户隔离。</span>
        <a href="https://github.com/liqinglq666/scholarforge-os/blob/main/docs/cloud-workspace.md" rel="noreferrer" target="_blank">数据边界与部署说明 ↗</a>
      </footer>
    </aside> : null}
  </div>;
}
