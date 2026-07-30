import { NextResponse } from 'next/server';

export function GET() {
  const authConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  return NextResponse.json({
    status: 'ok',
    service: 'ScholarForge OS',
    version: '1.1.0',
    ui: 'document-aware-cloud-research-workspace',
    provider: 'Alibaba Cloud Model Studio',
    model: process.env.DASHSCOPE_MODEL || 'qwen-plus',
    workflow: 'task-aware-parallel-multi-agent',
    specialists: 4,
    taskTypes: ['translate', 'polish', 'precheck', 'review-response'],
    reviewSections: 7,
    reviewModes: 3,
    terminologyLocks: true,
    authorDecisionStates: 4,
    documentIngestion: true,
    documentFormats: ['docx', 'text-based-pdf'],
    documentParsingLocation: 'browser',
    documentSectionDetection: true,
    documentChunkLimit: 12000,
    scannedPdfOcr: false,
    localReviewHistory: true,
    projectHub: true,
    workflowTemplates: 4,
    localWorkspaceBackup: true,
    localWorkspaceRestore: true,
    cloudWorkspaceSupported: true,
    cloudWorkspaceConfigured: authConfigured,
    cloudWorkspaceMigration: 'supabase/migrations/20260730_cloud_workspace.sql',
    cloudWorkspaceIsolation: 'Supabase RLS by auth.uid()',
    localFallback: true,
    workspaceAccess: 'authenticated-session-required',
    guestAccess: true,
    modelStudioConfigured: Boolean(process.env.DASHSCOPE_API_KEY),
    authProvider: 'Supabase Auth',
    authConfigured,
    timestamp: new Date().toISOString(),
  });
}
