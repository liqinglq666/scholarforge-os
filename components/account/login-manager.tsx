'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { StatusBanner } from '@/components/feedback/status-banner';
import type { AuthStatus } from '@/lib/types';

const FALLBACK_STATUS: AuthStatus = {
  configured: false,
  authenticated: false,
  user: null,
  message: '暂时无法读取账户状态，仍可使用游客本地模式。',
};

export function LoginManager() {
  const router = useRouter();
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/auth/session', { cache: 'no-store' })
      .then((response) => response.json() as Promise<AuthStatus>)
      .then((payload) => { if (active) setStatus(payload); })
      .catch(() => { if (active) setStatus(FALLBACK_STATUS); });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json() as Partial<AuthStatus> & { error?: string };
      if (!response.ok) throw new Error(payload.error || '登录未完成，请稍后重试。');
      window.dispatchEvent(new Event('scholarforge-auth-change'));
      router.replace('/account');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登录未完成，请稍后重试。');
    } finally {
      setSubmitting(false);
    }
  }

  if (!status) {
    return (
      <div className="login-loading" role="status">
        <span className="spinner large" />
        <strong>正在确认账户状态</strong>
        <p>不会读取或上传你的论文正文。</p>
      </div>
    );
  }

  return (
    <div className="login-layout">
      <section className="login-story" aria-labelledby="login-story-title">
        <Link aria-label="返回 ScholarForge OS 首页" className="login-brand" href="/">
          <span aria-hidden="true">SF</span>
          <strong>ScholarForge</strong>
        </Link>
        <div>
          <span className="eyebrow">账户只同步偏好</span>
          <h1 id="login-story-title">让你的科研写作环境跨设备保持一致</h1>
          <p>登录后可以同步学科背景、默认任务、英美拼写、术语规则和论文章节模板。未发表论文、导师意见、版本全文与分析记录仍默认保存在当前浏览器。</p>
        </div>
        <ul className="login-benefits">
          <li><strong>个性化工作流</strong><span>保存默认任务、章节、期刊语境和解释详细度。</span></li>
          <li><strong>术语保持一致</strong><span>跨项目复用材料、量表、算法与缩写的指定表达。</span></li>
          <li><strong>正文仍由你控制</strong><span>登录不会自动上传现有论文，也不会替代完整工作区备份。</span></li>
        </ul>
        <small>AI 只提供建议；科研事实、引用、统计与最终文本始终由作者核对。</small>
      </section>

      <section className="login-card" aria-labelledby="login-title">
        {error ? <StatusBanner tone="danger" title="登录未完成">{error}</StatusBanner> : null}

        {!status.configured ? (
          <div className="login-state-card">
            <span className="login-state-mark" aria-hidden="true">!</span>
            <span className="eyebrow">游客模式可继续使用</span>
            <h2 id="login-title">账户服务尚未开启</h2>
            <p>当前部署没有配置 Supabase 登录服务。论文项目、审校工作台和本地个性化设置仍可正常使用。</p>
            <div className="login-actions stacked">
              <Link className="primary-link" href="/workspace">继续使用游客模式</Link>
              <Link className="secondary-link" href="/account">查看账户配置说明</Link>
            </div>
          </div>
        ) : status.authenticated && status.user ? (
          <div className="login-state-card">
            <span className="login-avatar" aria-hidden="true">{(status.user.displayName || status.user.email).slice(0, 1).toUpperCase()}</span>
            <span className="eyebrow">已登录</span>
            <h2 id="login-title">欢迎回来，{status.user.displayName || status.user.email.split('@')[0]}</h2>
            <p>当前账户为 <strong>{status.user.email}</strong>。你可以进入账户中心管理同步范围，或直接继续工作。</p>
            <div className="login-actions stacked">
              <Link className="primary-link" href="/workspace">进入审校工作台</Link>
              <Link className="secondary-link" href="/account">管理账户</Link>
            </div>
          </div>
        ) : (
          <>
            <div className="login-card-heading">
              <span className="eyebrow">欢迎回来</span>
              <h2 id="login-title">登录 ScholarForge</h2>
              <p>使用邮箱和密码登录。登录只恢复账户偏好，不会自动上传此浏览器中的论文。</p>
            </div>

            <form className="login-form" onSubmit={(event) => void submit(event)}>
              <label>
                <span>邮箱</span>
                <input
                  autoComplete="email"
                  autoFocus
                  inputMode="email"
                  maxLength={254}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  required
                  type="email"
                  value={email}
                />
              </label>
              <label>
                <span>密码</span>
                <span className="password-field">
                  <input
                    autoComplete="current-password"
                    maxLength={128}
                    minLength={8}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="至少 8 位"
                    required
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                  />
                  <button
                    aria-label={showPassword ? '隐藏密码' : '显示密码'}
                    onClick={() => setShowPassword((value) => !value)}
                    type="button"
                  >
                    {showPassword ? '隐藏' : '显示'}
                  </button>
                </span>
              </label>
              <button className="primary-button login-submit" disabled={submitting} type="submit">
                {submitting ? '正在登录…' : '登录账户'}
              </button>
            </form>

            <div className="login-secondary-actions">
              <p>还没有账户？<Link href="/account">前往账户中心注册</Link></p>
              <Link href="/workspace">暂不登录，继续使用游客模式</Link>
            </div>

            <div className="login-privacy-note">
              <strong>数据边界</strong>
              <span>账户仅同步已验证的个性化偏好；论文正文、导师意见、版本全文和历史任务仍留在本地。</span>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
