import type { Metadata } from 'next';
import { SettingsManager } from '@/components/settings/settings-manager';

export const metadata: Metadata = { title: '数据与设置' };

export default function SettingsPage() {
  return <main className="shell page-main" id="main-content"><SettingsManager /></main>;
}
