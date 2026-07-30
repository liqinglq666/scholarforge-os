import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'ScholarForge OS',
    version: '0.4.0',
    provider: 'Alibaba Cloud Model Studio',
    model: process.env.DASHSCOPE_MODEL || 'qwen-plus',
    workflow: 'parallel-multi-agent',
    specialists: 4,
    modelStudioConfigured: Boolean(process.env.DASHSCOPE_API_KEY),
    timestamp: new Date().toISOString(),
  });
}
