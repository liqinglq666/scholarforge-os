import type { Metadata } from 'next';
import { ProjectManager } from '@/components/project/project-manager';
import { ProjectToolNav } from '@/components/project/project-tool-nav';

export const metadata: Metadata = { title: '论文项目' };

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <main className="shell page-main project-main" id="main-content"><ProjectToolNav projectId={projectId} /><ProjectManager projectId={projectId} /></main>;
}
