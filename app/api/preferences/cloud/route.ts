import { NextResponse } from 'next/server';
import {
  applyAuthCookies,
  assertSameOrigin,
  clearAuthCookies,
  readSupabaseError,
  resolveAuthSession,
  supabaseRequest,
} from '@/lib/auth/supabase';
import { parseUserPreferences } from '@/lib/workspace/schema';
import { isRecord } from '@/lib/validation/common';

function unauthorized(clearCookies = false) {
  const response = NextResponse.json({ error: '请先登录账户。' }, { status: 401 });
  if (clearCookies) clearAuthCookies(response);
  return response;
}

export async function GET() {
  const session = await resolveAuthSession();
  if (!session.configured) return NextResponse.json({ error: '账户服务未配置。' }, { status: 503 });
  if (!session.user || !session.accessToken) return unauthorized(true);

  const path = `/rest/v1/user_preferences?user_id=eq.${encodeURIComponent(session.user.id)}&select=preferences,updated_at&limit=1`;
  const upstream = await supabaseRequest(path, { method: 'GET' }, session.accessToken);
  if (!upstream.ok) {
    const error = await readSupabaseError(upstream, '无法读取云端偏好。请确认已执行数据库迁移。');
    return NextResponse.json({ error }, { status: 502 });
  }
  const rows = await upstream.json() as unknown;
  const first = Array.isArray(rows) && isRecord(rows[0]) ? rows[0] : null;
  const response = NextResponse.json({
    preferences: first ? parseUserPreferences(first.preferences) : null,
    updatedAt: first && typeof first.updated_at === 'string' ? first.updated_at : null,
  });
  if (session.refreshedSession) applyAuthCookies(response, session.refreshedSession);
  return response;
}

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '请求来源无效。' }, { status: 403 });
  }
  const session = await resolveAuthSession();
  if (!session.configured) return NextResponse.json({ error: '账户服务未配置。' }, { status: 503 });
  if (!session.user || !session.accessToken) return unauthorized(true);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '偏好请求不是有效 JSON。' }, { status: 400 });
  }
  const rawPreferences = isRecord(body) && 'preferences' in body ? body.preferences : body;
  const preferences = parseUserPreferences(rawPreferences);
  const updatedAt = new Date().toISOString();
  const upstream = await supabaseRequest('/rest/v1/user_preferences?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ user_id: session.user.id, preferences, updated_at: updatedAt }),
  }, session.accessToken);
  if (!upstream.ok) {
    const error = await readSupabaseError(upstream, '无法保存云端偏好。请确认已执行数据库迁移。');
    return NextResponse.json({ error }, { status: 502 });
  }
  const response = NextResponse.json({ preferences, updatedAt, message: '个性化偏好已同步。论文正文没有上传。' });
  if (session.refreshedSession) applyAuthCookies(response, session.refreshedSession);
  return response;
}
