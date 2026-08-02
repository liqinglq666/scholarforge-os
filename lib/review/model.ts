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

export async function reviewWithModel(request: ReviewRequest): Promise<ReviewResult> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new ValidationError('分析服务未配置。你的正文没有发送给模型。', 'SERVICE_NOT_CONFIGURED', 503);

  const baseUrl = (process.env.DASHSCOPE_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
  const model = process.env.DASHSCOPE_MODEL || 'qwen-plus';
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

  const payload = await response.json() as {
    choices?: Array<{ finish_reason?: string; message?: { content?: string } }>;
  };
  const choice = payload.choices?.[0];
  if (!choice?.message?.content) throw new ValidationError('模型返回了空结果。', 'EMPTY_MODEL_OUTPUT', 502);
  if (choice.finish_reason === 'length') throw new ValidationError('模型输出被截断，请缩短输入后重试。', 'MODEL_OUTPUT_TRUNCATED', 502);
  return normalizeModelResult(parseJsonOutput(choice.message.content), request);
}
