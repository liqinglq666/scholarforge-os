import {
  APP_NAME,
  APP_VERSION,
  MAX_REQUEST_BYTES,
  MAX_SOURCE_CHARACTERS,
} from '@/lib/config';
import { RATE_LIMITS } from '@/lib/security/rate-limit';
import type { ReviewServiceStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

export function GET() {
  const configured = Boolean(process.env.DASHSCOPE_API_KEY?.trim());
  const model = process.env.DASHSCOPE_MODEL?.trim() || 'qwen-plus';
  const payload: ReviewServiceStatus & { service: string; version: string } = {
    service: APP_NAME,
    version: APP_VERSION,
    configured,
    model: configured ? model : null,
    message: configured
      ? '分析服务已配置。只有在你确认并开始分析后，所选文本才会发送给模型。'
      : '分析服务未配置。仍可编辑、保存、恢复和导出本地工作区；不会生成模拟结果。',
    limits: {
      maxCharacters: MAX_SOURCE_CHARACTERS,
      maxRequestBytes: MAX_REQUEST_BYTES,
      requestsPerWindow: RATE_LIMITS.requestsPerWindow,
      windowMinutes: RATE_LIMITS.windowMinutes,
    },
  };
  return Response.json(payload, {
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
