import type { Metadata } from 'next';
import { LoginManager } from '@/components/account/login-manager';
import '../login.css';

export const metadata: Metadata = {
  title: '登录',
  description: '登录 ScholarForge OS，同步个性化科研写作偏好；论文正文默认继续保存在当前浏览器。',
};

export default function LoginPage() {
  return (
    <main className="login-main" id="main-content">
      <LoginManager />
    </main>
  );
}
