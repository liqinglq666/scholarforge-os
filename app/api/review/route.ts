import { NextResponse } from 'next/server';
import { reviewWithBailian } from '@/lib/bailian';
import { createDemoReview } from '@/lib/demo-review';
import type { ReviewRequest } from '@/lib/types';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json() as Partial<ReviewRequest>;
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const targetJournal = typeof body.targetJournal === 'string'
      ? body.targetJournal.trim().slice(0, 160)
      : '';

    if (text.length < 40) {
      return NextResponse.json(
        { error: 'Please provide at least 40 characters of manuscript text.' },
        { status: 400 },
      );
    }

    if (text.length > 12_000) {
      return NextResponse.json(
        { error: 'The first version supports up to 12,000 characters per review.' },
        { status: 400 },
      );
    }

    if (!process.env.DASHSCOPE_API_KEY) {
      return NextResponse.json(createDemoReview(text));
    }

    const result = await reviewWithBailian(text, targetJournal);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown review error.';
    console.error('Review request failed:', message);

    return NextResponse.json(
      {
        error: 'The live review failed. Check the Model Studio API key, base URL, model, and quota.',
        detail: process.env.NODE_ENV === 'development' ? message : undefined,
      },
      { status: 502 },
    );
  }
}
