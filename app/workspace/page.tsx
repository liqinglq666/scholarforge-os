import type { Metadata } from 'next';
import { WorkspaceApp } from '@/components/workspace/workspace-app';
import '../editorial-workspace.css';
import '../editorial-review.css';
import '../edit-passport.css';
import '../professional-ui-fixes.css';

export const metadata: Metadata = { title: '工作台' };

export default function WorkspacePage() {
  return <div id="main-content"><WorkspaceApp /></div>;
}
