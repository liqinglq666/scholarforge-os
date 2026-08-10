import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountManager } from '@/components/account/account-manager';

const authMock = vi.hoisted(() => ({
  status: {
    configured: true,
    authenticated: true,
    user: {
      id: '00000000-0000-4000-8000-000000000001',
      email: 'researcher@example.com',
      displayName: 'Researcher',
    },
    unavailable: true,
    message: '账户服务暂时不可用。现有登录凭据已保留，请稍后重试。',
  },
  setStatus: vi.fn(),
  reloadStatus: vi.fn(),
}));

vi.mock('@/components/account/use-auth-status', () => ({
  useAuthStatus: () => authMock,
}));

describe('AccountManager outage state', () => {
  beforeEach(() => {
    authMock.setStatus.mockReset();
    authMock.reloadStatus.mockReset();
    authMock.reloadStatus.mockResolvedValue(authMock.status);
  });

  it('shows a recoverable outage without presenting the account as unconfigured or signed out', () => {
    render(<AccountManager />);

    expect(screen.getByRole('heading', { name: '账户服务暂时不可用，登录凭据没有被删除' })).toBeInTheDocument();
    expect(screen.getByText(/最近一次已确认的账户是 researcher@example.com/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重试账户状态' })).toBeInTheDocument();
    expect(screen.queryByText('账户服务尚未配置')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '退出登录' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '创建账户' })).not.toBeInTheDocument();
  });
});
