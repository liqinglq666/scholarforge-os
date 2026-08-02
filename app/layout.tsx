import type { Metadata, Viewport } from 'next';
import { AppFooter, AppHeader } from '@/components/app-shell/app-header';
import './globals.css';
import './workflow.css';
import './examples.css';
import './project.css';
import './revision.css';
import './preferences.css';
import './login.css';
import './ui-system.css';
import './competition.css';

export const metadata: Metadata = {
  title: {
    default: 'ScholarForge OS｜阻止 AI 误改科研事实',
    template: '%s · ScholarForge OS',
  },
  description: '为科研论文增加 AI 修改安全门：代码独立检查数值、单位、引用、术语、因果边界和研究范围，作者逐条决定是否采用。',
  applicationName: 'ScholarForge OS',
  keywords: ['科研事实安全', 'AI 论文审校', '学术写作', '科研中译英', '英文润色', '投稿前检查', '作者控制'],
  icons: { icon: '/icon.svg', shortcut: '/icon.svg', apple: '/icon.svg' },
  openGraph: {
    title: 'ScholarForge OS｜阻止 AI 误改科研事实',
    description: '普通 AI 帮助修改论文，ScholarForge 负责阻止 AI 改错论文。AI 提建议，作者做决定。',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'ScholarForge OS｜科研事实安全门',
    description: '模型只生成候选修改；代码独立决定是否允许进入作者工作稿。',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light',
  themeColor: '#f4f1ea',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html data-scroll-behavior="smooth" lang="zh-CN">
      <body>
        <a className="skip-link" href="#main-content">跳到主要内容</a>
        <AppHeader />
        {children}
        <AppFooter />
      </body>
    </html>
  );
}
