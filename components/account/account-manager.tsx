'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { StatusBanner } from '@/components/feedback/status-banner';
import type { AuthStatus } from '@/lib/types';

export function AccountManager() {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function loadStatus() {
    try {
      const response = await fetch('/api/auth/session', { cache: 'no-store' });
      const payload = await response.json() as AuthStatus;
      setStatus(payload);
    } catch {
      setStatus({ configured: false, authenticated: false, user: null, message: '暂时无法读取账户状态，仍可使用游客本地模式。' });
    }
  }

  useEffect(() => {
    let active = true;
    fetch('/api/auth/session', { cache: 'no-store' })
      .then((response) => response.json() as Promise<AuthStatus>)
      .then((payload) => { if (active) setStatus(payload); })
      .catch(() => {
        if (active) setStatus({ configured: false, authenticated: false, user: null, message: '暂时无法读取账户状态，仍可使用游客本地模式。' });
      });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(mode === 'sign-up' ? '/api/auth/sign-up' : '/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName }),
      });
      const payload = await response.json() as Partial<AuthStatus> & { error?: string };
      if (!response.ok) throw new Error(payload.error || '账户操作失败。');
      setStatus({
        configured: payload.configured === true,
        authenticated: payload.authenticated === true,
        user: payload.user || null,
        message: payload.message || '账户状态已更新。',
      });
      setMessage(payload.message || '账户状态已更新。');
      setPassword('');
      window.dispatchEvent(new Event('scholarforge-auth-change'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '账户操作失败。');
    } finally {
      setSubmitting(false);
    }
  }

  async function signOut() {
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/auth/session', { method: 'DELETE' });
      const payload = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(payload.error || '退出失败。');
      await loadStatus();
      setMessage(payload.message || '已退出账户。');
      window.dispatchEvent(new Event('scholarforge-auth-change'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '退出失败。');
    } finally {
      setSubmitting(false);
    }
  }

  if (!status) {
    return <div className="loading-state" role="status"><span className="spinner" /><strong>正在读取账户状态</strong></div>;
  }

  return (
    <div className="account-content">
      <div className="page-heading">
        <div><span className="eyebrow">可选账户 · 游客模式始终可用</span><h1>登录用于同步偏好，不自动上传论文</h1></div>
        <p>邮箱账户只保存你的个性化配置。论文项目、章节正文、导师意见和版本内容仍保存在当前浏览器，除非未来明确启用单独的项目同步功能。</p>
      </div>

      {message ? <StatusBanner tone="success" title="账户状态">{message}</StatusBanner> : null}
      {error ? <StatusBanner tone="danger" title="账户操作未完成">{error}</StatusBanner> : null}

      {!status.configured ? (
        <section className="account-panel account-unconfigured">
          <span className="eyebrow">当前为游客本地模式</span>
          <h2>账户服务尚未配置</h2>
          <p>产品功能不会被禁用。要开启邮箱注册、登录和偏好同步，请在部署环境设置以下变量，并执行仓库中的 Supabase 迁移：</p>
          <pre><code>SUPABASE_URL=https://your-project.supabase.co{`\n`}SUPABASE_PUBLISHABLE_KEY=your-publishable-key</code></pre>
          <p className="account-note">数据库脚本：<code>supabase/migrations/202608020001_user_preferences.sql</code></p>
          <div className="account-actions"><Link className="primary-link" href="/preferences">先设置本地个性化偏好</Link><Link className="secondary-link" href="/settings">查看数据说明</Link></div>
        </section>
      ) : status.authenticated && status.user ? (
        <section className="account-panel account-signed-in">
          <span className="eyebrow">已登录</span>
          <h2>{status.user.displayName || status.user.email}</h2>
          <dl className="account-facts">
            <div><dt>邮箱</dt><dd>{status.user.email}</dd></div>
            <div><dt>账户同步范围</dt><dd>学科、默认任务、写作规则、章节模板与显示偏好</dd></div>
            <div><dt>仍只保存在本地</dt><dd>论文正文、导师意见、版本文本、分析结果与历史任务</dd></div>
          </dl>
          <div className="account-actions"><Link className="primary-link" href="/preferences">管理并同步偏好</Link><button className="secondary-button" disabled={submitting} onClick={() => void signOut()} type="button">退出登录</button></div>
        </section>
      ) : (
        <div className="account-grid">
          <section className="account-panel">
            <div className="account-mode" role="tablist" aria-label="账户操作">
              <button aria-selected={mode === 'sign-in'} className={mode === 'sign-in' ? 'active' : ''} onClick={() => setMode('sign-in')} role="tab" type="button">登录</button>
              <button aria-selected={mode === 'sign-up'} className={mode === 'sign-up' ? 'active' : ''} onClick={() => setMode('sign-up')} role="tab" type="button">注册</button>
            </div>
            <form className="account-form" onSubmit={(event) => void submit(event)}>
              {mode === 'sign-up' ? <label><span>显示名称（可选）</span><input autoComplete="name" maxLength={80} onChange={(event) => setDisplayName(event.target.value)} value={displayName} /></label> : null}
              <label><span>邮箱</span><input autoComplete="email" inputMode="email" maxLength={254} onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label>
              <label><span>密码</span><input autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'} minLength={8} maxLength={128} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label>
              <button className="primary-button" disabled={submitting} type="submit">{submitting ? '正在处理…' : mode === 'sign-up' ? '创建账户' : '登录账户'}</button>
            </form>
            <small>{mode === 'sign-up' ? '部署方可以在 Supabase 中开启邮箱确认。收到确认邮件时，请先完成确认再登录。' : '登录不会把此浏览器中的论文数据自动上传。'}</small>
          </section>
          <aside className="account-boundary">
            <span className="eyebrow">账户边界</span>
            <h2>登录解决跨设备偏好，不混淆数据归属</h2>
            <ul>
              <li>同步默认任务、期刊、学科、术语规则与章节模板。</li>
              <li>不自动同步未发表论文、导师原话和版本全文。</li>
              <li>退出登录不会删除本地工作区。</li>
              <li>清理浏览器数据前仍应导出完整工作区备份。</li>
            </ul>
          </aside>
        </div>
      )}
    </div>
  );
}
