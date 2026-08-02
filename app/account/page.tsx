import type { Metadata } from 'next';
import { AccountManager } from '@/components/account/account-manager';

export const metadata: Metadata = {
  title: '账户',
  description: '可选登录用于同步个性化偏好；论文正文默认继续保存在当前浏览器。',
};

export default function AccountPage() {
  return <main className="shell page-main account-main" id="main-content"><AccountManager /></main>;
}
