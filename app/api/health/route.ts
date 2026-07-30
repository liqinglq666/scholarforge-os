import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'ScholarForge OS',
    version: '0.7.0',
    ui: 'project-aware-editorial-workspace',
    provider: 'Alibaba Cloud Model Studio',
    model: process.env.DASHSCOPE_MODEL || 'qwen-plus',
    workflow: 'section-aware-parallel-multi-agent',
    specialists: 4,
    reviewSections: 7,
    reviewModes: 3,
    authorDecisionStates: 4,
    localReviewHistory: true,
    workspaceAccess: 'authenticated-session-required',
    guestAccess: true,
    modelStudioConfigured: Boolean(process.env.DASHSCOPE_API_KEY),
    authProvider: 'Supabase Auth',
    authConfigured: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
    timestamp: new Date().toISOString(),
  });
}
