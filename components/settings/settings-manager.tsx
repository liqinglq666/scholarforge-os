'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspace } from '@/components/workspace/use-workspace';
import { StatusBanner } from '@/components/feedback/status-banner';
import { APP_VERSION } from '@/lib/config';
import { exportWorkspaceBackup } from '@/lib/exports/files';
import type { ReviewServiceStatus, WorkspaceBackup } from '@/lib/types';
import { clearWorkspaceData, writeWorkspaceData } from '@/lib/workspace/storage';
import { createPersistedWorkspace, parseBackupText } from '@/lib/workspace/schema';

export function SettingsManager() {
  const router = useRouter();
  const { data, ready, replaceData } = useWorkspace();
  const clearRef = useRef<HTMLDialogElement>(null);
  const importRef = useRef<HTMLDialogElement>(null);
  const [service, setService] = useState<ReviewServiceStatus | null>(null);
  const [message, setMessage] = useState('');
  const [importPreview, setImportPreview] = useState<WorkspaceBackup | null>(null);

  useEffect(() => {
    fetch('/api/health', { cache: 'no-store' })
      .then((response) => response.json() as Promise<ReviewServiceStatus>)
      .then(setService)
      .catch(() => setService(null));
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
    const next = { version: 2 as const, current: importPreview.current, history: importPreview.history, updatedAt: new Date().toISOString() };
    try {
      writeWorkspaceData(next);
      replaceData(next);
      setMessage('备份验证并导入成功。所有应用记录已依据当前问题重新生成，不可信偏移已丢弃。');
      setImportPreview(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '备份写入失败。当前工作区没有改变。');
    }
  }

  function confirmClear() {
    try {
      clearWorkspaceData();
      replaceData(createPersistedWorkspace());
      setMessage('此浏览器中的 ScholarForge 草稿、结果和历史已清除。已下载的导出文件不受影响。');
      router.push('/workspace');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '无法清除本地数据。');
    }
  }

  if (!ready) return <div className="loading-state" role="status"><span className="spinner" /><strong>正在读取设置</strong></div>;

  return (
    <div className="settings-content">
      <div className="page-heading">
        <div><span className="eyebrow">数据、隐私与限制</span><h1>知道文本在哪里，知道 AI 做了什么</h1></div>
        <p>ScholarForge 默认把工作区保存在此浏览器。只有作者确认开始分析后，所选文本才会经服务端发送给模型。</p>
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

      <section className="settings-section" aria-labelledby="data-title">
        <div><span className="step-number">02</span><h2 id="data-title">数据如何处理</h2></div>
        <div className="privacy-grid">
          <article><strong>保存在此浏览器</strong><p>当前草稿、分析结果、作者决定、工作稿和最近 12 条历史。没有账户或云同步。</p></article>
          <article><strong>仅在确认后发送</strong><p>所选正文、任务设置、目标期刊文本和术语锁。原始 DOCX 文件不会上传。</p></article>
          <article><strong>不上传的内容</strong><p>DOCX 二进制文件、未选章节、其他浏览器文件、历史任务与导出文件。</p></article>
          <article><strong>作者责任</strong><p>必须核对事实、数值、单位、引用、术语、统计、方法、因果关系和结论强度。</p></article>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="backup-title">
        <div><span className="step-number">03</span><h2 id="backup-title">备份与恢复</h2></div>
        <p>备份采用可检查的 JSON。导入前会验证格式并预览影响；来自备份的编辑偏移不会被信任，而是根据当前问题重新定位。</p>
        <div className="settings-actions">
          <button onClick={() => exportWorkspaceBackup(data)} type="button">导出工作区备份</button>
          <label className="file-button"><input accept="application/json,.json" onChange={(event) => void chooseBackup(event)} type="file" />导入备份</label>
          <button className="danger-button" onClick={() => clearRef.current?.showModal()} type="button">清除此浏览器数据</button>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="limits-title">
        <div><span className="step-number">04</span><h2 id="limits-title">当前明确限制</h2></div>
        <ul className="limit-list">
          <li>不支持 PDF、扫描 OCR、旧版 DOC、公式和表格结构解析。</li>
          <li>DOCX 导入只提取正文；清洁 DOCX 导出不会保留原文件样式、图片、批注或修订痕迹。</li>
          <li>不验证参考文献真实性、统计正确性、期刊最新要求或论文是否可录用。</li>
          <li>不提供账户、云同步、团队协作、审稿回复自动生成或一键批量应用建议。</li>
          <li>浏览器数据可能因清理站点数据、无痕模式或换设备而丢失，请定期导出备份。</li>
        </ul>
        <p className="version-line">ScholarForge OS v{APP_VERSION}</p>
      </section>

      <dialog className="confirm-dialog" ref={importRef}>
        <form method="dialog">
          <span className="eyebrow">导入预览</span><h2>确认替换当前工作区？</h2>
          <p>备份包含“{importPreview?.current.draft.projectName || '未命名任务'}”和 {importPreview?.history.length || 0} 条历史。确认后会替换当前本地工作区。</p>
          <div className="responsibility-note"><strong>安全恢复</strong><span>篡改、越界、冲突或无法根据当前问题重新定位的编辑会被丢弃。</span></div>
          <div className="dialog-actions"><button value="cancel">取消</button><button className="primary-button" onClick={confirmImport} value="confirm">确认导入</button></div>
        </form>
      </dialog>

      <dialog className="confirm-dialog" ref={clearRef}>
        <form method="dialog">
          <span className="eyebrow">不可撤销操作</span><h2>清除此浏览器中的全部数据？</h2>
          <p>当前草稿、分析结果、作者决定和最近任务都会被删除。已下载的备份与导出文件不受影响。</p>
          <div className="dialog-actions"><button value="cancel">保留数据</button><button className="danger-button" onClick={confirmClear} value="confirm">确认清除</button></div>
        </form>
      </dialog>
    </div>
  );
}
