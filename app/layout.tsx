import type { Metadata } from 'next';
import { AccountDock } from '@/components/account-dock';
import { AuthGate } from '@/components/auth-gate';
import { AuthProvider } from '@/components/auth-provider';
import { CloudWorkspaceDock } from '@/components/cloud-workspace-dock';
import { DocumentImportDock } from '@/components/document-import-dock';
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
import './v10.css';
import './v10-fixes.css';
import './v11.css';

export const metadata: Metadata = {
  title: {
    default: 'ScholarForge OS｜研语工坊',
    template: '%s · ScholarForge OS',
  },
  description: '支持 DOCX/PDF 章节导入、云端论文项目与阿里云百炼多 Agent 审校的科研写作工作台',
  applicationName: 'ScholarForge OS',
  keywords: ['科研英语', 'DOCX 论文导入', 'PDF 章节解析', '学术翻译', '英文润色', '审稿回复', '云端论文项目', '多智能体', '阿里云百炼', 'qwen-plus'],
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  openGraph: {
    title: 'ScholarForge OS｜研语工坊',
    description: '导入 DOCX/PDF 论文章节，进入翻译、润色、投稿预检和返修信工作流，让每次修改都留在用户隔离的证据链里。',
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
            <CloudWorkspaceDock />
            <DocumentImportDock />
          </AuthGate>
        </AuthProvider>
      </body>
    </html>
  );
}
