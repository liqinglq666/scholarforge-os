import { MAX_MODEL_OUTPUT_CHARACTERS, MODEL_TIMEOUT_MS } from '@/lib/config';
import type { ReviewRequest, ReviewResult } from '@/lib/types';
import { buildReviewPrompt } from '@/lib/review/prompt';
import { normalizeModelResult, ValidationError } from '@/lib/review/validation';

const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

function stripJsonFence(value: string) {
  return value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

function parseJsonOutput(value: string) {
  const normalized = stripJsonFence(value);
  if (!normalized) throw new ValidationError('模型返回了空内容。', 'EMPTY_MODEL_OUTPUT', 502);
  if (normalized.length > MAX_MODEL_OUTPUT_CHARACTERS) {
    throw new ValidationError('模型输出超过安全长度限制。', 'MODEL_OUTPUT_TOO_LARGE', 502);
  }
  try {
    return JSON.parse(normalized) as unknown;
  } catch {
    throw new ValidationError('模型没有返回完整的 JSON，可能发生了截断。', 'INVALID_MODEL_JSON', 502);
  }
}

async function parseProviderPayload(response: Response) {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ValidationError('模型服务返回了无法解析的响应。', 'INVALID_PROVIDER_RESPONSE', 502);
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ValidationError('模型服务返回了无效的响应结构。', 'INVALID_PROVIDER_RESPONSE', 502);
  }
  return payload as {
    choices?: Array<{ finish_reason?: string | null; message?: { content?: string } }>;
  };
}

export async function reviewWithModel(request: ReviewRequest): Promise<ReviewResult> {
  const apiKey = process.env.DASHSCOPE_API_KEY?.trim();
  if (!apiKey) throw new ValidationError('分析服务未配置。你的正文没有发送给模型。', 'SERVICE_NOT_CONFIGURED', 503);

  const baseUrl = (process.env.DASHSCOPE_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/$/, '');
  const model = process.env.DASHSCOPE_MODEL?.trim() || 'qwen-plus';
  const prompt = buildReviewPrompt(request);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0.15,
        response_format: { type: 'json_object' },
        max_tokens: 8_000,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
      }),
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ValidationError('分析超时。正文仍保留在你的浏览器中，可以稍后重试。', 'MODEL_TIMEOUT', 504);
    }
    throw new ValidationError('无法连接分析服务。正文仍保留在你的浏览器中。', 'MODEL_UNAVAILABLE', 502);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    if (response.status === 429) throw new ValidationError('模型服务当前繁忙，请稍后重试。', 'PROVIDER_RATE_LIMITED', 429);
    throw new ValidationError(`模型服务返回错误（${response.status}）。`, 'MODEL_ERROR', 502);
  }

  const payload = await parseProviderPayload(response);
  const choice = payload.choices?.[0];
  if (!choice?.message?.content) throw new ValidationError('模型返回了空结果。', 'EMPTY_MODEL_OUTPUT', 502);
  if (choice.finish_reason === 'length') {
    throw new ValidationError('模型输出被截断，请缩短输入后重试。', 'MODEL_OUTPUT_TRUNCATED', 502);
  }
  if (choice.finish_reason && choice.finish_reason !== 'stop') {
    throw new ValidationError('模型响应未正常结束，请稍后重试。', 'MODEL_OUTPUT_INCOMPLETE', 502);
  }
  return normalizeModelResult(parseJsonOutput(choice.message.content), request);
}
