import type { Metadata } from 'next';
import { ProjectToolNav } from '@/components/project/project-tool-nav';
import { VersionManager } from '@/components/project/version-manager';

export const metadata: Metadata = { title: '版本记录' };

export default async function VersionsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <main className="shell page-main project-main" id="main-content"><ProjectToolNav projectId={projectId} /><VersionManager projectId={projectId} /></main>;
}
