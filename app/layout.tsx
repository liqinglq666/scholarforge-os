import type { Metadata } from 'next';
import './globals.css';
import './v04.css';

export const metadata: Metadata = {
  title: 'ScholarForge OS｜研语工坊',
  description: '基于阿里云百炼 qwen-plus 的多智能体科研英语审校与投稿工作台',
  applicationName: 'ScholarForge OS',
  keywords: ['科研英语', '学术写作', '多智能体', '阿里云百炼', 'qwen-plus'],
  openGraph: {
    title: 'ScholarForge OS｜研语工坊',
    description: '让科研英语修改像同行评审一样有证据。',
    type: 'website',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
