import type { Metadata, Viewport } from 'next';
import { AppFooter, AppHeader } from '@/components/app-shell/app-header';
import './globals.css';
import './workflow.css';

export const metadata: Metadata = {
  title: {
    default: 'ScholarForge OS｜作者控制的科研英语工作台',
    template: '%s · ScholarForge OS',
  },
  description: '面向科研中译英、英文保守润色和投稿前检查的作者控制工作台。逐条核对 AI 建议，安全应用，并保留可恢复的本地工作区。',
  applicationName: 'ScholarForge OS',
  keywords: ['科研英语', '学术翻译', '英文润色', '投稿前检查', '作者核对', 'DOCX 正文提取'],
  icons: { icon: '/icon.svg', shortcut: '/icon.svg', apple: '/icon.svg' },
  openGraph: {
    title: 'ScholarForge OS｜作者控制的科研英语工作台',
    description: 'AI 提建议，作者做决定。保护数值、术语、证据边界和原始文本。',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light',
  themeColor: '#f5f2eb',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <a className="skip-link" href="#main-content">跳到主要内容</a>
        <AppHeader />
        {children}
        <AppFooter />
      </body>
    </html>
  );
}
