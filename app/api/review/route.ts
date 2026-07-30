import { NextResponse } from 'next/server';
import { reviewWithBailian } from '@/lib/bailian';
import { createDemoReview } from '@/lib/demo-review';
import type { ReviewRequest } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();

  try {
    const body = await request.json() as Partial<ReviewRequest>;
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const targetJournal = typeof body.targetJournal === 'string'
      ? body.targetJournal.trim().slice(0, 160)
      : '';

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

    const result = process.env.DASHSCOPE_API_KEY
      ? await reviewWithBailian(text, targetJournal)
      : createDemoReview(text);

    return NextResponse.json({ ...result, requestId }, {
      headers: {
        'Cache-Control': 'no-store',
        'X-ScholarForge-Workflow': result.workflowVersion,
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
