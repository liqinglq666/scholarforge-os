import type { Metadata, Viewport } from 'next';
import { AccountDock } from '@/components/account-dock';
import { AuthGate } from '@/components/auth-gate';
import { AuthProvider } from '@/components/auth-provider';
import { AuthorEditingDock } from '@/components/author-editing-dock';
import { CloudWorkspaceDock } from '@/components/cloud-workspace-dock';
import { DocumentImportDock } from '@/components/document-import-dock';
import { OriginalDocxPatchDock } from '@/components/original-docx-patch-dock';
import './globals.css';
import './v04.css';
import './auth.css';
import './auth-inline.css';
import './auth-gate.css';
import './v06.css';
import './workbench-responsive.css';
import './v07.css';
import './v08.css';
import './v09.css';
import './v10.css';
import './v11.css';
import './v12.css';
import './v13.css';
import './history-preview.css';
import './product-ui.css';

export const metadata: Metadata = {
  title: {
    default: 'ScholarForge OS｜研语工坊',
    template: '%s · ScholarForge OS',
  },
  description: '面向科研论文翻译、润色、投稿预检与审稿回复的多 Agent 写作工作台，支持 DOCX/PDF 导入、作者决策与原始 Word 结构保留交付。',
  applicationName: 'ScholarForge OS',
  keywords: ['科研英语', '原始 DOCX 补丁', 'Word 修订痕迹', 'DOCX 论文导入', '作者修改', '学术翻译', '英文润色', '审稿回复', '云端论文项目', '多智能体', '阿里云百炼', 'qwen-plus'],
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  openGraph: {
    title: 'ScholarForge OS｜研语工坊',
    description: '导入论文、运行多 Agent 审校、逐条核对证据，并把安全修改写回保留原样式与结构的 DOCX 修订版。',
    type: 'website',
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
    <html lang="zh-CN">
      <body>
        <AuthProvider>
          <AuthGate>
            {children}
            <AccountDock />
            <CloudWorkspaceDock />
            <DocumentImportDock />
            <AuthorEditingDock />
            <OriginalDocxPatchDock />
          </AuthGate>
        </AuthProvider>
      </body>
    </html>
  );
}
