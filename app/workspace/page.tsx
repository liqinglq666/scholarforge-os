import type { Metadata } from 'next';
import { WorkspaceApp } from '@/components/workspace/workspace-app';

export const metadata: Metadata = { title: '工作台' };

export default function WorkspacePage() {
  return <div id="main-content"><WorkspaceApp /></div>;
}
