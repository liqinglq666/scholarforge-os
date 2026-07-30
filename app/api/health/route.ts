import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'ScholarForge OS',
    version: '0.8.0',
    ui: 'paperlens-multi-workflow-workspace',
    provider: 'Alibaba Cloud Model Studio',
    model: process.env.DASHSCOPE_MODEL || 'qwen-plus',
    workflow: 'task-aware-parallel-multi-agent',
    specialists: 4,
    taskTypes: ['translate', 'polish', 'precheck', 'review-response'],
    reviewSections: 7,
    reviewModes: 3,
    terminologyLocks: true,
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
