import { NextResponse } from 'next/server';
import { reviewWithBailian } from '@/lib/bailian';
import { createDemoReview } from '@/lib/demo-review';
import type { ReviewMode, ReviewRequest, ReviewSection } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

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

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();

  try {
    const body = await request.json() as Partial<ReviewRequest>;
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const projectTitle = typeof body.projectTitle === 'string' ? body.projectTitle.trim().slice(0, 120) : '';
    const targetJournal = typeof body.targetJournal === 'string' ? body.targetJournal.trim().slice(0, 160) : '';
    const sectionType = VALID_SECTIONS.has(body.sectionType as ReviewSection)
      ? body.sectionType as ReviewSection
      : 'general';
    const reviewMode = VALID_MODES.has(body.reviewMode as ReviewMode)
      ? body.reviewMode as ReviewMode
      : 'balanced';

    if (text.length < 40) {
      return NextResponse.json(
        { error: 'Please provide at least 40 characters of manuscript text.', requestId },
        { status: 400 },
      );
    }

    if (text.length > 12_000) {
      return NextResponse.json(
        { error: 'The current review workspace supports up to 12,000 characters per run.', requestId },
        { status: 400 },
      );
    }

    const options = { projectTitle, targetJournal, sectionType, reviewMode };
    const result = process.env.DASHSCOPE_API_KEY
      ? await reviewWithBailian(text, options)
      : createDemoReview(text, options);

    return NextResponse.json({ ...result, requestId }, {
      headers: {
        'Cache-Control': 'no-store',
        'X-ScholarForge-Workflow': result.workflowVersion,
        'X-ScholarForge-Section': sectionType,
        'X-ScholarForge-Mode': reviewMode,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown review error.';
    console.error(`[ScholarForge:${requestId}] review failed:`, message);

    return NextResponse.json(
      {
        error: 'The live multi-agent review failed. Check the Model Studio key, endpoint, model, quota, and Vercel function logs.',
        detail: process.env.NODE_ENV === 'development' ? message : undefined,
        requestId,
      },
      { status: 502 },
    );
  }
}
