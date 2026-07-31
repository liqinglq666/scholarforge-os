import { NextResponse } from 'next/server';
import { APP_VERSION } from '@/lib/app-config';

export function GET() {
  const analysisConfigured = Boolean(process.env.DASHSCOPE_API_KEY?.trim());

  return NextResponse.json({
    status: analysisConfigured ? 'ready' : 'unconfigured',
    service: 'ScholarForge OS',
    version: APP_VERSION,
    taskTypes: ['translate', 'polish', 'precheck'],
    documentFormats: ['docx'],
    cleanDocxExport: true,
    localWorkspace: true,
    analysisConfigured,
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
