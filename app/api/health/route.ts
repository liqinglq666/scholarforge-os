import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'ScholarForge OS',
    modelStudioConfigured: Boolean(process.env.DASHSCOPE_API_KEY),
    timestamp: new Date().toISOString(),
  });
}
