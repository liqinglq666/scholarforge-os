import type { Metadata } from 'next';
import './globals.css';
import './v02.css';

export const metadata: Metadata = {
  title: 'ScholarForge OS｜研语工坊',
  description: '基于阿里云百炼的多智能体科研英语审校与投稿工作台',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
