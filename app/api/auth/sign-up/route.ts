import { NextResponse } from 'next/server';
import {
  applyAuthCookies,
  assertSameOrigin,
  getSupabaseConfig,
  parseAuthSession,
  readSupabaseError,
  supabaseRequest,
} from '@/lib/auth/supabase';
import type { AuthStatus } from '@/lib/types';
import { cleanSingleLine, isRecord } from '@/lib/validation/common';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '请求来源无效。' }, { status: 403 });
  }
  if (!getSupabaseConfig()) {
    return NextResponse.json({ error: '账户服务未配置。请设置 SUPABASE_URL 和 SUPABASE_PUBLISHABLE_KEY。' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
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

  const upstream = await supabaseRequest('/auth/v1/signup', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      data: displayName ? { display_name: displayName } : {},
    }),
  });
  if (!upstream.ok) {
    const error = await readSupabaseError(upstream, '注册失败，请稍后重试。');
    return NextResponse.json({ error }, { status: upstream.status === 429 ? 429 : 400 });
  }

  const payload = await upstream.json() as unknown;
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

  return NextResponse.json<AuthStatus>({
    configured: true,
    authenticated: false,
    user: null,
    message: '注册请求已提交。请检查邮箱并完成确认后再登录。',
  });
}
