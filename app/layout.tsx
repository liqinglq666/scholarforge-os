import type { Metadata } from 'next';
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
import './v06-fixes.css';
import './v07.css';
import './v08.css';
import './v09.css';
import './v10.css';
import './v11.css';
import './v12.css';
import './v13.css';
import './v133.css';

export const metadata: Metadata = {
  title: {
    default: 'ScholarForge OS｜研语工坊',
    template: '%s · ScholarForge OS',
  },
  description: '支持 DOCX/PDF 导入、云端论文项目、作者修改和原始 DOCX 结构保留补丁的科研写作工作台',
  applicationName: 'ScholarForge OS',
  keywords: ['科研英语', '原始 DOCX 补丁', 'Word 修订痕迹', 'DOCX 论文导入', '作者修改', '学术翻译', '英文润色', '审稿回复', '云端论文项目', '多智能体', '阿里云百炼', 'qwen-plus'],
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  openGraph: {
    title: 'ScholarForge OS｜研语工坊',
    description: '导入论文、运行多 Agent 审校、逐条应用建议，并把安全修改写回保留原样式与结构的 DOCX 修订版。',
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
            <AuthorEditingDock />
            <OriginalDocxPatchDock />
          </AuthGate>
        </AuthProvider>
      </body>
    </html>
  );
}
