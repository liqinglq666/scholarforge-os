import type { Metadata } from 'next';
import { FeedbackManager } from '@/components/project/feedback-manager';
import { ProjectToolNav } from '@/components/project/project-tool-nav';

export const metadata: Metadata = { title: '意见与回复' };

export default async function FeedbackPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <main className="shell page-main project-main" id="main-content"><ProjectToolNav projectId={projectId} /><FeedbackManager projectId={projectId} /></main>;
}
