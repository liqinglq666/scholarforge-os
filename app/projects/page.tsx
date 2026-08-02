import type { Metadata } from 'next';
import { ProjectPortfolio } from '@/components/project/project-portfolio';

export const metadata: Metadata = {
  title: '我的项目',
  description: '管理多篇论文项目，以及每个项目中的章节、意见、版本和审校流程。',
};

export default function ProjectsPage() {
  return <main className="shell page-main project-main" id="main-content"><ProjectPortfolio /></main>;
}
