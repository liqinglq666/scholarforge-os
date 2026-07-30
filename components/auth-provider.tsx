'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';

const DEMO_SESSION_KEY = 'scholarforge.auth.demo-session.v1';
const AUTHOR_EDITING_SESSION_KEY = 'scholarforge-os-author-editing-session-v1';
const LEGACY_AUTHOR_EDITING_SESSION_KEY = 'scholarforge-os-author-editing-v1';

export type ScholarForgeUser = {
  id: string;
  email: string;
  displayName: string;
  mode: 'supabase' | 'demo' | 'guest';
};

type AuthActionResult = {
  ok: boolean;
  message: string;
  needsConfirmation?: boolean;
};

type AuthContextValue = {
  user: ScholarForgeUser | null;
  loading: boolean;
  supabaseConfigured: boolean;
  signIn: (email: string, password: string) => Promise<AuthActionResult>;
  signUp: (displayName: string, email: string, password: string) => Promise<AuthActionResult>;
  continueAsGuest: () => Promise<AuthActionResult>;
  requestPasswordReset: (email: string) => Promise<AuthActionResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeEmail(email?: string | null) {
  return (email || '').trim().toLowerCase();
}

function userFromSupabase(user: User): ScholarForgeUser {
  const email = normalizeEmail(user.email);
  const metadataName = typeof user.user_metadata?.full_name === 'string'
    ? user.user_metadata.full_name.trim()
    : '';

  return {
    id: user.id,
    email,
    displayName: metadataName || email.split('@')[0] || 'ScholarForge User',
    mode: 'supabase',
  };
}

function isLocalSession(value: unknown): value is ScholarForgeUser {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ScholarForgeUser>;
  return typeof candidate.id === 'string'
    && typeof candidate.email === 'string'
    && typeof candidate.displayName === 'string'
    && (candidate.mode === 'demo' || candidate.mode === 'guest');
}

function migrateAuthorEditingSession() {
  try {
    const current = window.localStorage.getItem(AUTHOR_EDITING_SESSION_KEY);
    const legacy = window.localStorage.getItem(LEGACY_AUTHOR_EDITING_SESSION_KEY);
    if (!current && legacy) window.localStorage.setItem(AUTHOR_EDITING_SESSION_KEY, legacy);
    if (legacy) window.localStorage.removeItem(LEGACY_AUTHOR_EDITING_SESSION_KEY);
  } catch {
    // Session migration is best-effort; restricted browser storage should not block authentication.
  }
}

function readDemoSession() {
  try {
    const raw = window.localStorage.getItem(DEMO_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isLocalSession(parsed)) {
      window.localStorage.removeItem(DEMO_SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    window.localStorage.removeItem(DEMO_SESSION_KEY);
    return null;
  }
}

function writeDemoSession(user: ScholarForgeUser | null) {
  if (!user || user.mode === 'supabase') {
    window.localStorage.removeItem(DEMO_SESSION_KEY);
    return;
  }
  window.localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(user));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ScholarForgeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const supabaseConfigured = isSupabaseConfigured();

  useEffect(() => {
    migrateAuthorEditingSession();
    let alive = true;
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      setUser(readDemoSession());
      setLoading(false);
      return;
    }

    void supabase.auth.getSession()
      .then(({ data }) => {
        if (!alive) return;
        setUser(data.session?.user ? userFromSupabase(data.session.user) : readDemoSession());
      })
      .catch(() => {
        if (!alive) return;
        setUser(readDemoSession());
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      if (session?.user) {
        writeDemoSession(null);
        setUser(userFromSupabase(session.user));
      } else {
        setUser(readDemoSession());
      }
      setLoading(false);
    });

    return () => {
      alive = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (emailInput: string, password: string): Promise<AuthActionResult> => {
    const email = normalizeEmail(emailInput);
    if (!email || !email.includes('@')) return { ok: false, message: '请输入有效的邮箱地址。' };
    if (password.length < 8) return { ok: false, message: '密码至少需要 8 个字符。' };

    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { ok: false, message: error.message || '登录失败，请检查邮箱和密码。' };
      if (!data.user) return { ok: false, message: '未能获取用户信息，请稍后重试。' };
      setUser(userFromSupabase(data.user));
      return { ok: true, message: '登录成功，正在进入论文工作区。' };
    }

    const demoUser: ScholarForgeUser = {
      id: `demo-${email}`,
      email,
      displayName: email.split('@')[0] || 'Demo User',
      mode: 'demo',
    };
    writeDemoSession(demoUser);
    setUser(demoUser);
    return { ok: true, message: '已进入本地演示账户。配置 Supabase 后可升级为云端账户。' };
  }, []);

  const signUp = useCallback(async (
    displayNameInput: string,
    emailInput: string,
    password: string,
  ): Promise<AuthActionResult> => {
    const displayName = displayNameInput.trim();
    const email = normalizeEmail(emailInput);
    if (displayName.length < 2) return { ok: false, message: '请填写至少 2 个字符的姓名或昵称。' };
    if (!email || !email.includes('@')) return { ok: false, message: '请输入有效的邮箱地址。' };
    if (password.length < 8) return { ok: false, message: '密码至少需要 8 个字符。' };

    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: displayName },
          emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined,
        },
      });

      if (error) return { ok: false, message: error.message || '注册失败，请稍后重试。' };
      if (data.session?.user) {
        setUser(userFromSupabase(data.session.user));
        return { ok: true, message: '账户创建成功，正在进入论文工作区。' };
      }

      return {
        ok: true,
        needsConfirmation: true,
        message: '注册申请已提交。请检查邮箱并完成验证后再登录。',
      };
    }

    const demoUser: ScholarForgeUser = {
      id: `demo-${email}`,
      email,
      displayName,
      mode: 'demo',
    };
    writeDemoSession(demoUser);
    setUser(demoUser);
    return { ok: true, message: '本地演示账户已创建。当前设备会记住此会话。' };
  }, []);

  const continueAsGuest = useCallback(async (): Promise<AuthActionResult> => {
    const guestUser: ScholarForgeUser = {
      id: `guest-${Date.now()}`,
      email: '',
      displayName: '访客研究员',
      mode: 'guest',
    };
    writeDemoSession(guestUser);
    setUser(guestUser);
    return { ok: true, message: '已进入访客模式。草稿仅保存在当前浏览器。' };
  }, []);

  const requestPasswordReset = useCallback(async (emailInput: string): Promise<AuthActionResult> => {
    const email = normalizeEmail(emailInput);
    if (!email || !email.includes('@')) return { ok: false, message: '请先填写有效的邮箱地址。' };

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { ok: false, message: '本地演示账户无需重置密码；配置 Supabase 后可启用邮件重置。' };
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) return { ok: false, message: error.message || '重置邮件发送失败。' };
    return { ok: true, message: '密码重置邮件已发送，请检查收件箱。' };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (supabase && user?.mode === 'supabase') {
      await supabase.auth.signOut({ scope: 'local' });
    }
    writeDemoSession(null);
    setUser(null);
  }, [user?.mode]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    supabaseConfigured,
    signIn,
    signUp,
    continueAsGuest,
    requestPasswordReset,
    signOut,
  }), [
    user,
    loading,
    supabaseConfigured,
    signIn,
    signUp,
    continueAsGuest,
    requestPasswordReset,
    signOut,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
