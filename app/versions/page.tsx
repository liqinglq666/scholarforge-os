import type { Metadata } from 'next';
import { ProjectToolNav } from '@/components/project/project-tool-nav';
import { VersionManager } from '@/components/project/version-manager';

export const metadata: Metadata = {
  title: '版本比较',
  description: '在浏览器中比较论文版本，记录修改来源与原因，并导出修改说明。',
};

export default function VersionsPage() {
  return <main className="shell page-main project-main" id="main-content"><ProjectToolNav /><VersionManager /></main>;
}
