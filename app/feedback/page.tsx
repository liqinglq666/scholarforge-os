import type { Metadata } from 'next';
import { FeedbackManager } from '@/components/project/feedback-manager';
import { ProjectToolNav } from '@/components/project/project-tool-nav';

export const metadata: Metadata = {
  title: '导师意见',
  description: '拆分、关联并追踪导师意见，记录作者处理说明并导出对照记录。',
};

export default function FeedbackPage() {
  return <main className="shell page-main project-main" id="main-content"><ProjectToolNav /><FeedbackManager /></main>;
}
