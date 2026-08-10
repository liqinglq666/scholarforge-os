import { NextResponse } from 'next/server';
import {
  applyAuthCookies,
  assertSameOrigin,
  getSupabaseConfig,
  parseAuthSession,
  readSupabaseError,
  SupabaseRequestFailure,
  supabaseRequest,
} from '@/lib/auth/supabase';
import { MAX_AUTH_REQUEST_BYTES } from '@/lib/config';
import { RequestBodyTooLargeError, readRequestTextWithLimit } from '@/lib/security/request-body';
import type { AuthStatus } from '@/lib/types';
import { cleanSingleLine, isRecord } from '@/lib/validation/common';

function hasPendingSignupUser(value: unknown) {
  if (!isRecord(value) || !isRecord(value.user)) return false;
  return typeof value.user.id === 'string' && typeof value.user.email === 'string';
}

function retryAfterSeconds(response: Response, fallback = 30) {
  const parsed = Number.parseInt(response.headers.get('retry-after') || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 3600) : fallback;
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
    return NextResponse.json({ error: '注册请求过大。' }, { status: 413 });
  }

  let raw: string;
  try {
    raw = await readRequestTextWithLimit(request, MAX_AUTH_REQUEST_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: '注册请求过大。' }, { status: 413 });
    }
    return NextResponse.json({ error: '无法读取注册请求。' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw) as unknown;
  } catch {
    return NextResponse.json({ error: '注册请求不是有效 JSON。' }, { status: 400 });
  }
  if (!isRecord(body)) return NextResponse.json({ error: '注册请求格式无效。' }, { status: 400 });
  const email = cleanSingleLine(body.email, 254).toLowerCase();
  const displayName = cleanSingleLine(body.displayName, 80);
  const password = typeof body.password === 'string' ? body.password : '';
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || password.length > 128) {
    return NextResponse.json({ error: '请输入有效邮箱和 8–128 位密码。' }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await supabaseRequest('/auth/v1/signup', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        data: displayName ? { display_name: displayName } : {},
      }),
    });
  } catch (error) {
    if (error instanceof SupabaseRequestFailure) {
      return NextResponse.json({ error: '账户服务暂时不可用，请稍后重试。' }, { status: 503 });
    }
    throw error;
  }
  if (!upstream.ok) {
    if (upstream.status === 429) {
      const retryAfter = retryAfterSeconds(upstream);
      return NextResponse.json(
        { error: '注册请求过于频繁，请稍后重试。', retryAfter },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } },
      );
    }
    if (upstream.status === 408 || upstream.status >= 500) {
      return NextResponse.json({ error: '账户服务暂时不可用，请稍后重试。' }, { status: 503 });
    }
    await readSupabaseError(upstream, '注册失败，请稍后重试。');
    return NextResponse.json({
      error: '无法完成注册。如果该邮箱已注册，请直接登录；否则请稍后重试。',
    }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await upstream.json() as unknown;
  } catch {
    return NextResponse.json({ error: '账户服务返回了无法解析的注册结果。' }, { status: 502 });
  }
  const session = parseAuthSession(payload);
  if (session) {
    const response = NextResponse.json<AuthStatus>({
      configured: true,
      authenticated: true,
      user: session.user,
      message: '注册并登录成功。论文正文仍只保存在当前浏览器。',
    });
    applyAuthCookies(response, session);
    return response;
  }

  if (!hasPendingSignupUser(payload)) {
    return NextResponse.json({ error: '账户服务返回了无效注册结果。' }, { status: 502 });
  }

  return NextResponse.json<AuthStatus>({
    configured: true,
    authenticated: false,
    user: null,
    message: '注册请求已提交。请检查邮箱并完成确认后再登录。',
  });
}
