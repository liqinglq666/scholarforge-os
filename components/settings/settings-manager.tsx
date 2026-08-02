'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspace } from '@/components/workspace/use-workspace';
import { StatusBanner } from '@/components/feedback/status-banner';
import { APP_VERSION } from '@/lib/config';
import { exportWorkspaceBackup } from '@/lib/exports/files';
import type { AuthStatus, ReviewServiceStatus, WorkspaceBackup } from '@/lib/types';
import { clearWorkspaceData, writeWorkspaceData } from '@/lib/workspace/storage';
import { createPersistedWorkspace, parseBackupText } from '@/lib/workspace/schema';

export function SettingsManager() {
  const router = useRouter();
  const { data, ready, replaceData } = useWorkspace();
  const clearRef = useRef<HTMLDialogElement>(null);
  const importRef = useRef<HTMLDialogElement>(null);
  const [service, setService] = useState<ReviewServiceStatus | null>(null);
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [message, setMessage] = useState('');
  const [importPreview, setImportPreview] = useState<WorkspaceBackup | null>(null);

  useEffect(() => {
    fetch('/api/health', { cache: 'no-store' })
      .then((response) => response.json() as Promise<ReviewServiceStatus>)
      .then(setService)
      .catch(() => setService(null));
    fetch('/api/auth/session', { cache: 'no-store' })
      .then((response) => response.json() as Promise<AuthStatus>)
      .then(setAuth)
      .catch(() => setAuth(null));
  }, []);

  async function chooseBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setMessage('');
    try {
      const preview = parseBackupText(await file.text());
      setImportPreview(preview);
      importRef.current?.showModal();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '备份导入失败。当前工作区没有改变。');
    }
  }

  function confirmImport() {
    if (!importPreview) return;
    const next = {
      version: 2 as const,
      current: importPreview.current,
      history: importPreview.history,
      project: importPreview.project || null,
      preferences: importPreview.preferences,
      updatedAt: new Date().toISOString(),
    };
    try {
      writeWorkspaceData(next);
      replaceData(next);
      setMessage('备份验证并导入成功。论文项目、导师意见、版本记录、个性化偏好和工作区已恢复；不可信编辑偏移已重新定位。');
      setImportPreview(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '备份写入失败。当前工作区没有改变。');
    }
  }

  function confirmClear() {
    try {
      clearWorkspaceData();
      replaceData(createPersistedWorkspace());
      setMessage('此浏览器中的论文项目、草稿、结果、历史和本地偏好已清除。账户中的云端偏好没有删除。');
      router.push('/workspace');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '无法清除本地数据。');
    }
  }

  if (!ready) return <div className="loading-state" role="status"><span className="spinner" /><strong>正在读取设置</strong></div>;

  return (
    <div className="settings-content">
      <div className="page-heading">
        <div><span className="eyebrow">数据、账户、隐私与限制</span><h1>知道文本在哪里，知道账户同步了什么</h1></div>
        <p>ScholarForge 默认把论文项目保存在当前浏览器。可选账户只同步个性化偏好；只有作者确认分析后，当前所选章节才会发送给模型。</p>
      </div>
      {message ? <StatusBanner tone="neutral" title="操作结果">{message}</StatusBanner> : null}

      <section className="settings-section" aria-labelledby="service-title">
        <div><span className="step-number">01</span><h2 id="service-title">分析服务</h2></div>
        {service ? <StatusBanner tone={service.configured ? 'success' : 'warning'} title={service.configured ? '已配置' : '未配置'}>{service.message}</StatusBanner> : <StatusBanner tone="warning" title="状态暂时不可用">无法连接健康检查接口。为保护正文，工作台会禁用分析。</StatusBanner>}
        <dl className="settings-facts">
          <div><dt>模型</dt><dd>{service?.model || '未启用'}</dd></div>
          <div><dt>文本上限</dt><dd>{service?.limits.maxCharacters.toLocaleString() || '12,000'} 字符</dd></div>
          <div><dt>请求限制</dt><dd>{service ? `${service.limits.windowMinutes} 分钟 ${service.limits.requestsPerWindow} 次` : '状态未知'}</dd></div>
          <div><dt>未配置时</dt><dd>返回 503，不生成模拟结果</dd></div>
        </dl>
      </section>

      <section className="settings-section" aria-labelledby="personal-title">
        <div><span className="step-number">02</span><h2 id="personal-title">账户与个性化</h2></div>
        <div className="privacy-grid">
          <article><strong>个性化偏好</strong><p>设置学科、英美拼写、默认任务、解释详细度、自定义术语规则和论文章节模板。</p><Link className="secondary-link" href="/preferences">管理个性化</Link></article>
          <article><strong>{auth?.authenticated ? '账户已登录' : auth?.configured ? '账户可用' : '游客模式'}</strong><p>{auth?.authenticated ? `当前账户：${auth.user?.email || ''}。只同步偏好。` : auth?.configured ? '登录后可跨设备同步个性化偏好。' : '账户服务未配置，全部核心功能仍可本地使用。'}</p><Link className="secondary-link" href="/account">查看账户</Link></article>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="data-title">
        <div><span className="step-number">03</span><h2 id="data-title">数据如何处理</h2></div>
        <div className="privacy-grid">
          <article><strong>保存在此浏览器</strong><p>论文项目、章节、导师意见、版本文本、术语库、草稿、分析结果、作者决定和最近历史。</p></article>
          <article><strong>账户可同步</strong><p>仅同步个性化设置：学科、默认任务、英美拼写、解释详细度、表达规则和章节模板。</p></article>
          <article><strong>仅在确认后发送给模型</strong><p>当前打开章节的正文、任务设置、写作语境、学科标签与术语规则。其他章节和原始 DOCX 不会上传。</p></article>
          <article><strong>本地确定性功能</strong><p>跨章节检查、导师意见整理和版本比较在浏览器中运行，不调用模型。</p></article>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="backup-title">
        <div><span className="step-number">04</span><h2 id="backup-title">完整备份与恢复</h2></div>
        <p>备份包含论文项目、章节、导师意见、版本记录、个性化偏好、当前工作区与历史。账户同步不能替代完整备份。</p>
        <div className="settings-actions">
          <button onClick={() => exportWorkspaceBackup(data)} type="button">导出完整工作区备份</button>
          <label className="file-button"><input accept="application/json,.json" onChange={(event) => void chooseBackup(event)} type="file" />导入备份</label>
          <button className="danger-button" onClick={() => clearRef.current?.showModal()} type="button">清除此浏览器数据</button>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="limits-title">
        <div><span className="step-number">05</span><h2 id="limits-title">当前明确限制</h2></div>
        <ul className="limit-list">
          <li>账户登录只同步个性化偏好，不提供论文项目云同步或团队协作。</li>
          <li>不开放任意系统提示词；用户规则不能覆盖数值、引用、证据边界和不编造内容等安全约束。</li>
          <li>论文项目最多 12 个章节，每个章节最多 12,000 个字符；不会自动把整篇论文发送给模型。</li>
          <li>不支持 PDF、扫描 OCR、旧版 DOC、公式和表格结构解析，也不验证参考文献真实性或统计正确性。</li>
          <li>浏览器数据可能因清理站点数据、无痕模式或换设备而丢失，请定期导出完整备份。</li>
        </ul>
        <p className="version-line">ScholarForge OS v{APP_VERSION}</p>
      </section>

      <dialog className="confirm-dialog" ref={importRef}>
        <form method="dialog">
          <span className="eyebrow">导入预览</span><h2>确认替换当前本地数据？</h2>
          <p>备份包含“{importPreview?.current.draft.projectName || '未命名任务'}”、{importPreview?.history.length || 0} 条历史，以及{importPreview?.project ? `论文项目“${importPreview.project.name || '未命名项目'}”的 ${importPreview.project.chapters.length} 个章节` : '不包含论文项目'}。个性化偏好也会一并替换。</p>
          <div className="responsibility-note"><strong>安全恢复</strong><span>篡改、越界、冲突或无法根据当前问题重新定位的编辑会被丢弃。</span></div>
          <div className="dialog-actions"><button value="cancel">取消</button><button className="primary-button" onClick={confirmImport} value="confirm">确认导入</button></div>
        </form>
      </dialog>

      <dialog className="confirm-dialog" ref={clearRef}>
        <form method="dialog">
          <span className="eyebrow">不可撤销操作</span><h2>清除此浏览器中的全部数据？</h2>
          <p>论文项目、章节、导师意见、版本记录、当前草稿、分析结果、历史和本地偏好都会被删除。账户中的云端偏好与已下载文件不受影响。</p>
          <div className="dialog-actions"><button value="cancel">保留数据</button><button className="danger-button" onClick={confirmClear} value="confirm">确认清除</button></div>
        </form>
      </dialog>
    </div>
  );
}
