import type { Metadata, Viewport } from 'next';
import './styles/tokens.css';
import './styles/base.css';
import './styles/shell.css';
import './styles/workbench.css';
import './styles/responsive.css';

export const metadata: Metadata = {
  title: {
    default: 'ScholarForge OS｜研语工坊',
    template: '%s · ScholarForge OS',
  },
  description: '面向科研论文翻译、保守润色与投稿前检查的作者可控写作工作台。',
  applicationName: 'ScholarForge OS',
  keywords: ['科研英语', '学术翻译', '英文润色', '投稿预检', '作者决策', '多智能体', '阿里云百炼'],
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  openGraph: {
    title: 'ScholarForge OS｜研语工坊',
    description: '围绕论文、证据与作者决策组织科研英语审阅，并导出作者确认后的工作稿。',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light',
  themeColor: '#f4f5f7',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
