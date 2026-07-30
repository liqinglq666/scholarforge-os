import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'ScholarForge OS',
    version: '0.5.0',
    provider: 'Alibaba Cloud Model Studio',
    model: process.env.DASHSCOPE_MODEL || 'qwen-plus',
    workflow: 'parallel-multi-agent',
    specialists: 4,
    modelStudioConfigured: Boolean(process.env.DASHSCOPE_API_KEY),
    authProvider: 'Supabase Auth',
    authConfigured: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
    timestamp: new Date().toISOString(),
  });
}
