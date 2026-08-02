import type { Metadata } from 'next';
import { HistoryManager } from '@/components/history/history-manager';

export const metadata: Metadata = { title: '最近任务' };

export default function HistoryPage() {
  return <main className="shell page-main" id="main-content"><HistoryManager /></main>;
}
