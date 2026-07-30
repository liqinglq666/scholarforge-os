import type { Metadata } from 'next';
import { AccountDock } from '@/components/account-dock';
import { AuthGate } from '@/components/auth-gate';
import { AuthProvider } from '@/components/auth-provider';
import './globals.css';
import './v04.css';
import './auth.css';
import './auth-inline.css';
import './auth-gate.css';
import './v06.css';
import './v06-fixes.css';
import './v07.css';
import './v08.css';

export const metadata: Metadata = {
  title: {
    default: 'ScholarForge OS｜研语工坊',
    template: '%s · ScholarForge OS',
  },
  description: '基于阿里云百炼 qwen-plus 的科研中译英、英文润色、投稿预检与审稿回复多智能体工作台',
  applicationName: 'ScholarForge OS',
  keywords: ['科研英语', '学术翻译', '英文润色', '审稿回复', '多智能体', '阿里云百炼', 'qwen-plus'],
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  openGraph: {
    title: 'ScholarForge OS｜研语工坊',
    description: '从科研中译英到返修信，把科研英语变成可追踪、可核对的多 Agent 工作流。',
    type: 'website',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <AuthProvider>
          <AuthGate>
            {children}
            <AccountDock />
          </AuthGate>
        </AuthProvider>
      </body>
    </html>
  );
}
