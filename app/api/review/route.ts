import { MAX_REQUEST_BYTES } from '@/lib/config';
import { reviewWithModel } from '@/lib/review/model';
import { parseReviewRequest, ValidationError } from '@/lib/review/validation';
import { checkRateLimit, RATE_LIMITS, releaseRateLimitSlot } from '@/lib/security/rate-limit';
import { readRequestTextWithLimit, RequestBodyTooLargeError } from '@/lib/security/request-body';
import type { ApiErrorPayload } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

function json(payload: unknown, status: number, headers: Record<string, string> = {}) {
  return Response.json(payload, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  });
}

function errorPayload(error: string, code: string, requestId: string, detail?: string): ApiErrorPayload {
  return { error, code, requestId, ...(detail ? { detail } : {}) };
}

function requestTooLarge(requestId: string) {
  return json(errorPayload('请求内容超过 80 KB 限制。你的浏览器草稿未受影响。', 'REQUEST_TOO_LARGE', requestId), 413);
}

function logUnexpectedFailure(requestId: string, error: unknown) {
  const name = error instanceof Error ? error.name : 'UnknownError';
  console.error(`[ScholarForge:${requestId}] review failed (${name})`);
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_REQUEST_BYTES) return requestTooLarge(requestId);

  let raw: string;
  try {
    raw = await readRequestTextWithLimit(request, MAX_REQUEST_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return requestTooLarge(requestId);
    return json(errorPayload('无法读取请求正文。', 'INVALID_REQUEST_BODY', requestId), 400);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw) as unknown;
  } catch {
    return json(errorPayload('请求正文必须是有效 JSON。', 'INVALID_JSON', requestId), 400);
  }

  let parsed;
  try {
    parsed = parseReviewRequest(body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return json(errorPayload(error.message, error.code, requestId), error.status);
    }
    return json(errorPayload('请求校验失败。', 'INVALID_REQUEST', requestId), 400);
  }

  if (!process.env.DASHSCOPE_API_KEY) {
    return json(errorPayload('分析服务未配置。你的正文没有发送给模型，草稿仍保存在浏览器中。', 'SERVICE_NOT_CONFIGURED', requestId), 503);
  }

  const limit = checkRateLimit(request);
  if (!limit.allowed) {
    const message = limit.reason === 'budget'
      ? '今日分析预算已达到上限，请联系部署管理员或明日重试。'
      : limit.reason === 'concurrency'
        ? '当前分析任务过多，请稍后重试。'
        : '请求过于频繁，请稍后重试。';
    return json(
      { ...errorPayload(message, 'RATE_LIMITED', requestId), retryAfter: limit.retryAfter },
      429,
      { 'Retry-After': String(limit.retryAfter), 'X-RateLimit-Remaining': '0' },
    );
  }

  try {
    const result = await reviewWithModel(parsed);
    return json({ result, requestId }, 200, {
      'X-RateLimit-Limit': String(RATE_LIMITS.requestsPerWindow),
      'X-RateLimit-Remaining': String(limit.remaining),
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      const headers: Record<string, string> = error.status === 429 ? { 'Retry-After': '30' } : {};
      return json(errorPayload(error.message, error.code, requestId), error.status, headers);
    }
    logUnexpectedFailure(requestId, error);
    return json(
      errorPayload('分析失败。你的正文仍安全保存在浏览器中，可以稍后重试。', 'REVIEW_FAILED', requestId),
      502,
    );
  } finally {
    releaseRateLimitSlot();
  }
}
