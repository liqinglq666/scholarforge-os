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
import './v09.css';

export const metadata: Metadata = {
  title: {
    default: 'ScholarForge OS｜研语工坊',
    template: '%s · ScholarForge OS',
  },
  description: '基于阿里云百炼 qwen-plus 的科研写作项目中心，覆盖科研中译英、英文润色、投稿预检与审稿回复',
  applicationName: 'ScholarForge OS',
  keywords: ['科研英语', '学术翻译', '英文润色', '审稿回复', '论文项目', '多智能体', '阿里云百炼', 'qwen-plus'],
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  openGraph: {
    title: 'ScholarForge OS｜研语工坊',
    description: '从论文项目中心进入翻译、润色、投稿预检和返修信工作流，让每次修改都留在证据链里。',
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
