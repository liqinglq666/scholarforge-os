import type { Metadata } from 'next';
import { ProjectManager } from '@/components/project/project-manager';
import { ProjectToolNav } from '@/components/project/project-tool-nav';

export const metadata: Metadata = {
  title: '论文项目',
  description: '在一个本地项目中管理多个论文章节、共享术语库，并运行跨章节一致性检查。',
};

export default function ProjectPage() {
  return <main className="shell page-main project-main" id="main-content"><ProjectToolNav /><ProjectManager /></main>;
}
