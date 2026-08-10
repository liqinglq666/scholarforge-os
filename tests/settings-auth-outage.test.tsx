import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SettingsManager } from '@/components/settings/settings-manager';
import { createPersistedWorkspace } from '@/lib/workspace/schema';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/components/workspace/use-workspace', () => ({
  useWorkspace: () => ({
    data: createPersistedWorkspace(),
    ready: true,
    replaceData: vi.fn(),
  }),
}));

vi.mock('@/components/review/use-review-service-status', () => ({
  useReviewServiceStatus: () => ({
    status: {
      configured: true,
      model: 'qwen-plus',
      message: '分析服务已配置。',
      limits: {
        maxCharacters: 12_000,
        maxRequestBytes: 80_000,
        requestsPerWindow: 8,
        windowMinutes: 10,
      },
    },
    loading: false,
  }),
}));

vi.mock('@/components/account/use-auth-status', () => ({
  useAuthStatus: () => ({
    status: {
      configured: true,
      authenticated: true,
      user: {
        id: '00000000-0000-4000-8000-000000000001',
        email: 'researcher@example.com',
      },
      unavailable: true,
      message: '账户服务暂时不可用。',
    },
  }),
}));

describe('SettingsManager account outage state', () => {
  it('does not present a temporarily unverifiable account as definitely signed in', () => {
    render(<SettingsManager />);

    expect(screen.getByText('账户状态暂不可确认')).toBeInTheDocument();
    expect(screen.getByText(/最近一次已确认账户：researcher@example.com/)).toBeInTheDocument();
    expect(screen.getByText(/现有登录凭据已保留，本地功能可继续使用/)).toBeInTheDocument();
    expect(screen.queryByText('账户已登录')).not.toBeInTheDocument();
  });
});
