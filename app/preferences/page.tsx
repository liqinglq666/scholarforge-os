import type { Metadata } from 'next';
import { PreferencesManager } from '@/components/settings/preferences-manager';

export const metadata: Metadata = {
  title: '个性化',
  description: '设置学科、英文变体、默认任务、自定义术语规则与论文项目章节模板。',
};

export default function PreferencesPage() {
  return <main className="shell page-main preferences-main" id="main-content"><PreferencesManager /></main>;
}
