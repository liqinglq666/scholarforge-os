'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth-provider';

type AuthTab = 'signin' | 'signup';

type Notice = {
  tone: 'success' | 'error' | 'info';
  message: string;
} | null;

const SPECIALISTS = [
  ['T', 'Terminology Guardian', '术语与缩写一致性'],
  ['A', 'Academic Editor', '学术语言与保守润色'],
  ['L', 'Logic Auditor', '论证与证据边界'],
  ['M', 'Method Auditor', '方法完整性与复现'],
] as const;

function getDestination() {
  if (typeof window === 'undefined') return '/';
  const requested = new URLSearchParams(window.location.search).get('next');
  if (!requested || !requested.startsWith('/') || requested.startsWith('//')) return '/';
  return requested;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function LoginPage() {
  const router = useRouter();
  const {
    user,
    loading: sessionLoading,
    supabaseConfigured,
    signIn,
    signUp,
    continueAsGuest,
    requestPasswordReset,
  } = useAuth();
  const [tab, setTab] = useState<AuthTab>('signin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const authMode = useMemo(() => supabaseConfigured
    ? {
        label: 'Supabase Auth 已就绪',
        description: '注册与登录会创建真实云端会话。',
        tone: 'cloud',
      }
    : {
        label: '本地演示账户模式',
        description: '当前未配置 Supabase；账户仅保存在此浏览器，不会上传密码。',
        tone: 'demo',
      }, [supabaseConfigured]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setNotice(null);

    try {
      const result = tab === 'signin'
        ? await signIn(email, password)
        : await signUp(displayName, email, password);

      setNotice({ tone: result.ok ? 'success' : 'error', message: result.message });
      if (result.ok && !result.needsConfirmation) {
        window.setTimeout(() => router.replace(getDestination()), 520);
      }
    } catch (error) {
      setNotice({ tone: 'error', message: errorMessage(error, '账户请求失败，请检查网络后重试。') });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGuest() {
    setSubmitting(true);
    setNotice(null);
    try {
      const result = await continueAsGuest();
      setNotice({ tone: result.ok ? 'success' : 'error', message: result.message });
      if (result.ok) window.setTimeout(() => router.replace(getDestination()), 360);
    } catch (error) {
      setNotice({ tone: 'error', message: errorMessage(error, '无法创建访客会话，请检查浏览器存储权限。') });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReset() {
    setSubmitting(true);
    setNotice(null);
    try {
      const result = await requestPasswordReset(email);
      setNotice({ tone: result.ok ? 'success' : 'error', message: result.message });
    } catch (error) {
      setNotice({ tone: 'error', message: errorMessage(error, '密码重置请求失败，请稍后重试。') });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-page-glow auth-page-glow-one" />
      <div className="auth-page-glow auth-page-glow-two" />

      <section className="auth-story" aria-label="ScholarForge OS 产品介绍">
        <Link className="auth-brand" href="/login">
          <span className="auth-brand-mark">S</span>
          <span><strong>ScholarForge OS｜研语工坊</strong><small>Evidence-aware academic writing workspace</small></span>
        </Link>

        <div className="auth-story-copy">
          <div className="auth-eyebrow">Academic review workspace</div>
          <h1>让每一次科研英语修改，<em>都能被解释。</em></h1>
          <p>登录、注册或选择访客身份后进入论文工作台。账户入口负责确认当前会话，科研安全边界仍由多 Agent 工作流与确定性规则共同保护。</p>
        </div>

        <div className="auth-agent-board">
          <div className="auth-board-head">
            <span>Parallel specialist team</span>
            <b>4 agents</b>
          </div>
          <div className="auth-agent-list">
            {SPECIALISTS.map(([short, name, role], index) => (
              <div className="auth-agent-row" key={name}>
                <span className="auth-agent-index">0{index + 1}</span>
                <span className="auth-agent-avatar">{short}</span>
                <span><b>{name}</b><small>{role}</small></span>
                <i>ready</i>
              </div>
            ))}
          </div>
        </div>

        <div className="auth-trust-grid">
          <div><strong>4×</strong><span>独立百炼请求</span></div>
          <div><strong>0</strong><span>客户端暴露密钥</span></div>
          <div><strong>4</strong><span>真实下载格式</span></div>
        </div>

        <p className="auth-story-foot">Powered by Alibaba Cloud Model Studio · qwen-plus</p>
      </section>

      <section className="auth-panel-wrap">
        <div className="auth-panel">
          <div className={`auth-mode-badge tone-${authMode.tone}`}>
            <span />
            <div><b>{authMode.label}</b><small>{authMode.description}</small></div>
          </div>

          {sessionLoading ? (
            <div className="auth-session-loading" aria-live="polite">
              <span />
              <strong>正在读取账户会话…</strong>
            </div>
          ) : user ? (
            <div className="auth-existing-session">
              <span className="auth-existing-avatar">{user.displayName.slice(0, 2).toUpperCase()}</span>
              <div className="auth-eyebrow">Active session</div>
              <h2>欢迎回来，{user.displayName}</h2>
              <p>{user.mode === 'supabase' ? '你的云端账户会话仍然有效。' : user.mode === 'guest' ? '当前设备已保存访客会话。' : '当前设备已保存本地演示账户会话。'}</p>
              <button className="auth-primary-button" onClick={() => router.replace(getDestination())} type="button">继续进入论文工作台 <span>→</span></button>
              <a className="auth-secondary-link" href="https://github.com/liqinglq666/scholarforge-os" rel="noreferrer" target="_blank">查看项目仓库</a>
            </div>
          ) : (
            <>
              <div className="auth-panel-heading">
                <div className="auth-eyebrow">Account access</div>
                <h2>{tab === 'signin' ? '登录论文工作台' : '创建 ScholarForge 账户'}</h2>
                <p>{tab === 'signin' ? '完成身份确认后进入论文审校、作者待办与结果交付页面。' : '创建云端账户后，可主动同步按用户隔离的论文项目与任务历史。'}</p>
              </div>

              <div className="auth-tabs" role="tablist" aria-label="登录或注册">
                <button aria-selected={tab === 'signin'} onClick={() => { setTab('signin'); setNotice(null); }} role="tab" type="button">登录</button>
                <button aria-selected={tab === 'signup'} onClick={() => { setTab('signup'); setNotice(null); }} role="tab" type="button">注册</button>
              </div>

              <form className="auth-form" onSubmit={handleSubmit}>
                {tab === 'signup' ? (
                  <label>
                    <span>姓名或昵称</span>
                    <div className="auth-input-shell">
                      <span aria-hidden="true">署</span>
                      <input
                        autoComplete="name"
                        onChange={(event) => setDisplayName(event.target.value)}
                        placeholder="例如：Qing Li"
                        required
                        value={displayName}
                      />
                    </div>
                  </label>
                ) : null}

                <label>
                  <span>邮箱</span>
                  <div className="auth-input-shell">
                    <span aria-hidden="true">@</span>
                    <input
                      autoComplete="email"
                      inputMode="email"
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="researcher@example.com"
                      required
                      type="email"
                      value={email}
                    />
                  </div>
                </label>

                <label>
                  <span className="auth-label-row"><b>密码</b>{tab === 'signin' ? <button disabled={submitting} onClick={() => void handleReset()} type="button">忘记密码？</button> : <small>至少 8 个字符</small>}</span>
                  <div className="auth-input-shell">
                    <span aria-hidden="true">密</span>
                    <input
                      autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
                      minLength={8}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="输入密码"
                      required
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                    />
                    <button className="auth-password-toggle" onClick={() => setShowPassword((value) => !value)} type="button">{showPassword ? '隐藏' : '显示'}</button>
                  </div>
                </label>

                {notice ? <div aria-live="polite" className={`auth-notice tone-${notice.tone}`}>{notice.message}</div> : null}

                <button className="auth-primary-button" disabled={submitting} type="submit">
                  {submitting ? '正在处理…' : tab === 'signin' ? '登录并进入工作台' : '创建账户'}
                  {!submitting ? <span>→</span> : null}
                </button>
              </form>

              <div className="auth-divider"><span>或者</span></div>

              <button className="auth-guest-button" disabled={submitting} onClick={() => void handleGuest()} type="button">
                <span className="auth-guest-icon">游</span>
                <span><b>以访客身份进入</b><small>先创建访客会话，草稿只保存在当前浏览器</small></span>
                <i>→</i>
              </button>

              <p className="auth-legal">工作台需要有效会话。访客无需注册，但退出后不会拥有云端项目或跨设备历史记录。</p>
            </>
          )}
        </div>

        <a className="auth-back-link" href="https://github.com/liqinglq666/scholarforge-os" rel="noreferrer" target="_blank">查看 GitHub 仓库 ↗</a>
      </section>
    </main>
  );
}
