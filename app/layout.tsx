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
import './editorial-base.css';
import './editorial-try.css';
import './editorial-workspace.css';
import './editorial-review.css';
import './editorial-responsive.css';
import './professional-ui.css';

export const metadata: Metadata = {
  title: {
    default: 'ScholarForge OS｜AI 修改进入论文前的科研事实安全门',
    template: '%s · ScholarForge OS',
  },
  description: '在 AI 候选进入作者工作稿前，代码独立检查数值、单位、引用、术语、因果边界和研究范围，由作者逐条决定是否采用。',
  applicationName: 'ScholarForge OS',
  keywords: ['科研事实安全', 'AI 论文审校', '学术写作', '科研中译英', '英文润色', '投稿前检查', '作者控制'],
  icons: { icon: '/icon.svg', shortcut: '/icon.svg', apple: '/icon.svg' },
  openGraph: {
    title: 'ScholarForge OS｜科研事实安全门',
    description: '阻止高风险 AI 修改直接进入论文。模型提出候选，代码执行安全检查，作者决定最终文本。',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'ScholarForge OS｜科研事实安全门',
    description: '模型只生成候选修改；代码独立决定是否允许自动应用，最终文本始终由作者决定。',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light',
  themeColor: '#f3f5f7',
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
