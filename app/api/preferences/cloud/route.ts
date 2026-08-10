import { NextResponse } from 'next/server';
import {
  applyAuthCookies,
  assertSameOrigin,
  clearAuthCookies,
  readSupabaseError,
  resolveAuthSession,
  supabaseRequest,
} from '@/lib/auth/supabase';
import { MAX_REQUEST_BYTES } from '@/lib/config';
import {
  CloudPreferencesValidationError,
  parseCloudPreferencesWrite,
} from '@/lib/preferences/validation';
import {
  readRequestTextWithLimit,
  RequestBodyTooLargeError,
} from '@/lib/security/request-body';
import { parseUserPreferences } from '@/lib/workspace/schema';
import { isRecord } from '@/lib/validation/common';

function unauthorized(clearCookies = false) {
  const response = NextResponse.json({ error: '请先登录账户。' }, { status: 401 });
  if (clearCookies) clearAuthCookies(response);
  return response;
}

function requestTooLarge() {
  return NextResponse.json({ error: '偏好请求超过 80 KB 限制。' }, { status: 413 });
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

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_REQUEST_BYTES) return requestTooLarge();

  let raw: string;
  try {
    raw = await readRequestTextWithLimit(request, MAX_REQUEST_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return requestTooLarge();
    return NextResponse.json({ error: '无法读取偏好请求。' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw) as unknown;
  } catch {
    return NextResponse.json({ error: '偏好请求不是有效 JSON。' }, { status: 400 });
  }

  const rawPreferences = isRecord(body) && 'preferences' in body ? body.preferences : body;
  let preferences;
  try {
    preferences = parseCloudPreferencesWrite(rawPreferences);
  } catch (error) {
    if (error instanceof CloudPreferencesValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: '偏好数据校验失败。' }, { status: 400 });
  }

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
