import { NextResponse } from 'next/server';
import { APP_VERSION } from '@/lib/app-config';

export function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'ScholarForge OS',
    version: APP_VERSION,
    provider: 'Alibaba Cloud Model Studio',
    model: process.env.DASHSCOPE_MODEL || 'qwen-plus',
    taskTypes: ['translate', 'polish', 'precheck'],
    documentFormats: ['docx'],
    cleanDocxExport: true,
    localWorkspace: true,
    modelStudioConfigured: Boolean(process.env.DASHSCOPE_API_KEY),
    timestamp: new Date().toISOString(),
  });
}
