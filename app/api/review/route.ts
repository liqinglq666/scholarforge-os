import { NextResponse } from 'next/server';
import { WORKSPACE_TEXT_LIMIT } from '@/lib/app-config';
import { reviewWithBailian } from '@/lib/bailian';
import type {
  ReviewRequest,
  ReviewSection,
  TerminologyLock,
  WorkspaceTask,
} from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const VALID_TASKS = new Set<WorkspaceTask>(['translate', 'polish', 'precheck']);
const VALID_SECTIONS = new Set<ReviewSection>([
  'general',
  'abstract',
  'introduction',
  'methods',
  'results',
  'discussion',
  'conclusion',
]);

function sanitizeLocks(value: unknown): TerminologyLock[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.slice(0, 12).flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const source = typeof record.source === 'string' ? record.source.trim().slice(0, 120) : '';
    const preferred = typeof record.preferred === 'string' ? record.preferred.trim().slice(0, 160) : '';
    const note = typeof record.note === 'string' ? record.note.trim().slice(0, 240) : '';
    if (!source || !preferred) return [];
    const requestedId = typeof record.id === 'string' ? record.id.slice(0, 80) : '';
    let id = requestedId || `lock-${index + 1}`;
    while (seen.has(id)) id = `${id}-${index + 1}`;
    seen.add(id);
    return [{ id, source, preferred, note }];
  });
}

function noStoreJson(payload: unknown, status: number) {
  return NextResponse.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let parsed: unknown;

  try {
    parsed = await request.json() as unknown;
  } catch {
    return noStoreJson({ error: '请求内容必须是有效的 JSON。', requestId }, 400);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return noStoreJson({ error: '请求内容必须是 JSON 对象。', requestId }, 400);
  }
  const body = parsed as Partial<ReviewRequest>;

  try {
    if (body.taskType !== undefined && !VALID_TASKS.has(body.taskType as WorkspaceTask)) {
      return noStoreJson({ error: '不支持的任务类型。', requestId }, 400);
    }
    if (body.sectionType !== undefined && !VALID_SECTIONS.has(body.sectionType as ReviewSection)) {
      return noStoreJson({ error: '不支持的论文章节类型。', requestId }, 400);
    }
    const taskType = body.taskType as WorkspaceTask || 'precheck';
    const text = typeof body.text === 'string' ? body.text : '';
    const projectTitle = typeof body.projectTitle === 'string' ? body.projectTitle.trim().slice(0, 120) : '';
    const targetJournal = typeof body.targetJournal === 'string' ? body.targetJournal.trim().slice(0, 160) : '';
    const lockedTerms = sanitizeLocks(body.lockedTerms);
    const sectionType = VALID_SECTIONS.has(body.sectionType as ReviewSection)
      ? body.sectionType as ReviewSection
      : 'general';

    if (text.trim().length < 40) {
      return noStoreJson({ error: '请至少提供 40 个字符后再开始分析。', requestId }, 400);
    }

    if (text.length > WORKSPACE_TEXT_LIMIT) {
      return noStoreJson({ error: `当前工作台单次最多处理 ${WORKSPACE_TEXT_LIMIT.toLocaleString('en-US')} 个字符。`, requestId }, 400);
    }

    if (!process.env.DASHSCOPE_API_KEY?.trim()) {
      return noStoreJson({
        error: '分析服务尚未配置。请在部署环境中设置 DASHSCOPE_API_KEY 后重试。',
        code: 'SERVICE_NOT_CONFIGURED',
        requestId,
      }, 503);
    }

    const result = await reviewWithBailian(text, {
      projectTitle,
      taskType,
      targetJournal,
      sectionType,
      lockedTerms,
    });

    return NextResponse.json({ ...result, requestId }, {
      headers: {
        'Cache-Control': 'no-store',
        'X-ScholarForge-Request-Id': requestId,
        'X-ScholarForge-Task': taskType,
        'X-ScholarForge-Section': sectionType,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown review error.';
    console.error(`[ScholarForge:${requestId}] review failed:`, message);

    return noStoreJson({
      error: '分析服务调用失败，请稍后重试或检查部署配置。',
      detail: process.env.NODE_ENV === 'development' ? message : undefined,
      requestId,
    }, 502);
  }
}
