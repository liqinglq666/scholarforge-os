import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'ScholarForge OS',
    version: '0.2.0',
    workflow: 'parallel-multi-agent',
    specialists: 4,
    modelStudioConfigured: Boolean(process.env.DASHSCOPE_API_KEY),
    timestamp: new Date().toISOString(),
  });
}
