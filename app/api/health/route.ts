import { NextResponse } from 'next/server';
import { APP_VERSION } from '@/lib/app-config';

export function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'ScholarForge OS',
    version: APP_VERSION,
    ui: 'evidence-desk-research-workspace',
    provider: 'Alibaba Cloud Model Studio',
    model: process.env.DASHSCOPE_MODEL || 'qwen-plus',
    workflow: 'task-aware-parallel-multi-agent',
    specialists: 4,
    taskTypes: ['translate', 'polish', 'precheck', 'review-response'],
    reviewSections: 7,
    reviewModes: 3,
    terminologyLocks: true,
    authorDecisionStates: ['pending', 'accepted', 'deferred', 'dismissed'],
    safeIssueApply: true,
    restrictedBatchApply: true,
    issueAnchorModes: ['exact', 'whitespace-normalized'],
    overlappingEditProtection: true,
    authorUndoRedo: true,
    documentIngestion: true,
    documentFormats: ['docx', 'text-based-pdf'],
    documentParsingLocation: 'browser',
    scannedPdfOcr: false,
    docxCleanExport: true,
    docxTrackedChangesExport: true,
    localReviewHistory: true,
    localWorkspaceBackup: true,
    dataMode: 'browser-local',
    experienceSystem: {
      styleLayers: ['tokens', 'base', 'shell', 'workbench', 'responsive'],
      threeColumnEvidenceWorkspace: true,
      authorDecisionFirst: true,
      mobileSinglePanelNavigation: true,
      reducedMotionSupport: true,
    },
    modelStudioConfigured: Boolean(process.env.DASHSCOPE_API_KEY),
    timestamp: new Date().toISOString(),
  });
}
