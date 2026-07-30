import { NextResponse } from 'next/server';
import { reviewWithBailian } from '@/lib/bailian';
import { createDemoReview } from '@/lib/demo-review';
import type {
  ReviewMode,
  ReviewRequest,
  ReviewSection,
  TerminologyLock,
  WorkspaceTask,
} from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const VALID_TASKS = new Set<WorkspaceTask>(['translate', 'polish', 'precheck', 'review-response']);
const VALID_SECTIONS = new Set<ReviewSection>([
  'general',
  'abstract',
  'introduction',
  'methods',
  'results',
  'discussion',
  'conclusion',
]);
const VALID_MODES = new Set<ReviewMode>(['conservative', 'balanced', 'deep']);

function sanitizeLocks(value: unknown): TerminologyLock[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const source = typeof record.source === 'string' ? record.source.trim().slice(0, 120) : '';
    const preferred = typeof record.preferred === 'string' ? record.preferred.trim().slice(0, 160) : '';
    const note = typeof record.note === 'string' ? record.note.trim().slice(0, 240) : '';
    if (!source || !preferred) return [];
    return [{ id: typeof record.id === 'string' ? record.id.slice(0, 80) : `lock-${index + 1}`, source, preferred, note }];
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
  let body: Partial<ReviewRequest>;

  try {
    body = await request.json() as Partial<ReviewRequest>;
  } catch {
    return noStoreJson({ error: 'The request body must be valid JSON.', requestId }, 400);
  }

  try {
    const taskType = VALID_TASKS.has(body.taskType as WorkspaceTask)
      ? body.taskType as WorkspaceTask
      : 'precheck';
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const projectTitle = typeof body.projectTitle === 'string' ? body.projectTitle.trim().slice(0, 120) : '';
    const targetJournal = typeof body.targetJournal === 'string' ? body.targetJournal.trim().slice(0, 160) : '';
    const supportingContext = typeof body.supportingContext === 'string' ? body.supportingContext.trim().slice(0, 6_000) : '';
    const responseLocation = typeof body.responseLocation === 'string' ? body.responseLocation.trim().slice(0, 240) : '';
    const lockedTerms = sanitizeLocks(body.lockedTerms);
    const sectionType = VALID_SECTIONS.has(body.sectionType as ReviewSection)
      ? body.sectionType as ReviewSection
      : 'general';
    const reviewMode = VALID_MODES.has(body.reviewMode as ReviewMode)
      ? body.reviewMode as ReviewMode
      : 'balanced';
    const minimumLength = taskType === 'review-response' ? 20 : 40;

    if (text.length < minimumLength) {
      return noStoreJson(
        { error: `Please provide at least ${minimumLength} characters for this task.`, requestId },
        400,
      );
    }

    if (text.length > 12_000) {
      return noStoreJson(
        { error: 'The current workspace supports up to 12,000 characters in the primary input.', requestId },
        400,
      );
    }

    const options: Partial<ReviewRequest> = {
      projectTitle,
      taskType,
      targetJournal,
      sectionType,
      reviewMode,
      supportingContext,
      responseLocation,
      lockedTerms,
    };
    const result = process.env.DASHSCOPE_API_KEY
      ? await reviewWithBailian(text, options)
      : createDemoReview(text, options);

    return NextResponse.json({ ...result, requestId }, {
      headers: {
        'Cache-Control': 'no-store',
        'X-ScholarForge-Workflow': result.workflowVersion,
        'X-ScholarForge-Task': taskType,
        'X-ScholarForge-Section': sectionType,
        'X-ScholarForge-Mode': reviewMode,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown review error.';
    console.error(`[ScholarForge:${requestId}] review failed:`, message);

    return noStoreJson(
      {
        error: 'The live multi-agent workflow failed. Check the service configuration and deployment logs.',
        detail: process.env.NODE_ENV === 'development' ? message : undefined,
        requestId,
      },
      502,
    );
  }
}
