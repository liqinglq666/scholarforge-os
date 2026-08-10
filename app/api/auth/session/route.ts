import { NextResponse } from 'next/server';
import {
  applyAuthCookies,
  assertSameOrigin,
  clearAuthCookies,
  getSupabaseConfig,
  parseAuthSession,
  readSupabaseError,
  resolveAuthSession,
  SupabaseRequestFailure,
  supabaseRequest,
} from '@/lib/auth/supabase';
import { MAX_AUTH_REQUEST_BYTES } from '@/lib/config';
import { RequestBodyTooLargeError, readRequestTextWithLimit } from '@/lib/security/request-body';
import type { AuthStatus } from '@/lib/types';
import { cleanSingleLine, isRecord } from '@/lib/validation/common';

export async function GET() {
  const session = await resolveAuthSession();
  if (session.unavailable) {
    return NextResponse.json<AuthStatus>({
      configured: true,
      authenticated: false,
      user: null,
      message: '账户服务暂时不可用。现有登录凭据已保留，请稍后重试。',
    }, { status: 503 });
  }

  const payload: AuthStatus = session.configured
    ? session.user
      ? { configured: true, authenticated: true, user: session.user, message: '账户已登录。论文正文仍保存在当前浏览器。' }
      : { configured: true, authenticated: false, user: null, message: '账户服务已配置，当前未登录。' }
    : { configured: false, authenticated: false, user: null, message: '账户服务未配置，当前使用游客本地模式。' };
  const response = NextResponse.json(payload);
  if (session.refreshedSession) applyAuthCookies(response, session.refreshedSession);
  else if (session.configured && !session.user) clearAuthCookies(response);
  return response;
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '请求来源无效。' }, { status: 403 });
  }
  if (!getSupabaseConfig()) {
    return NextResponse.json({ error: '账户服务未配置。请设置 SUPABASE_URL 和 SUPABASE_PUBLISHABLE_KEY。' }, { status: 503 });
  }

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_AUTH_REQUEST_BYTES) {
    return NextResponse.json({ error: '登录请求过大。' }, { status: 413 });
  }

  let raw: string;
  try {
    raw = await readRequestTextWithLimit(request, MAX_AUTH_REQUEST_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: '登录请求过大。' }, { status: 413 });
    }
    return NextResponse.json({ error: '无法读取登录请求。' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw) as unknown;
  } catch {
    return NextResponse.json({ error: '登录请求不是有效 JSON。' }, { status: 400 });
  }
  if (!isRecord(body)) return NextResponse.json({ error: '登录请求格式无效。' }, { status: 400 });
  const email = cleanSingleLine(body.email, 254).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || password.length > 128) {
    return NextResponse.json({ error: '请输入有效邮箱和至少 8 位密码。' }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await supabaseRequest('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  } catch (error) {
    if (error instanceof SupabaseRequestFailure) {
      return NextResponse.json({ error: '账户服务暂时不可用，请稍后重试。' }, { status: 503 });
    }
    throw error;
  }
  if (!upstream.ok) {
    await readSupabaseError(upstream, '邮箱或密码不正确。');
    return NextResponse.json({ error: '邮箱或密码不正确，或邮箱尚未完成确认。' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await upstream.json() as unknown;
  } catch {
    return NextResponse.json({ error: '账户服务返回了无法解析的会话。' }, { status: 502 });
  }
  const session = parseAuthSession(payload);
  if (!session) return NextResponse.json({ error: '账户服务返回了无效会话。' }, { status: 502 });

  const response = NextResponse.json<AuthStatus>({
    configured: true,
    authenticated: true,
    user: session.user,
    message: '登录成功。当前论文数据仍保存在此浏览器。',
  });
  applyAuthCookies(response, session);
  return response;
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '请求来源无效。' }, { status: 403 });
  }
  const session = await resolveAuthSession();
  if (session.accessToken) {
    try {
      await supabaseRequest('/auth/v1/logout', { method: 'POST', body: '{}' }, session.accessToken);
    } catch {
      // Local cookie removal still signs this browser out.
    }
  }
  const response = NextResponse.json({ ok: true, message: '已退出账户。本地论文数据没有删除。' });
  clearAuthCookies(response);
  return response;
}
