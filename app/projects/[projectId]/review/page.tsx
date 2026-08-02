import type { Metadata } from 'next';
import { WorkspaceApp } from '@/components/workspace/workspace-app';

export const metadata: Metadata = { title: '项目审校' };

export default async function ProjectReviewPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <div id="main-content"><WorkspaceApp projectId={projectId} /></div>;
}
