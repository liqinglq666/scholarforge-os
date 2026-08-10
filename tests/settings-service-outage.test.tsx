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
      configured: false,
      model: null,
      message: '暂时无法确认服务状态。为了保护正文，分析按钮已禁用；本地编辑和导出仍可使用。',
      limits: {
        maxCharacters: 12_000,
        maxRequestBytes: 80_000,
        requestsPerWindow: 8,
        windowMinutes: 10,
      },
    },
    loading: false,
    failed: true,
    reloadStatus: vi.fn(),
  }),
}));

vi.mock('@/components/account/use-auth-status', () => ({
  useAuthStatus: () => ({
    status: {
      configured: true,
      authenticated: false,
      user: null,
      message: '未登录。',
    },
  }),
}));

describe('SettingsManager review-service outage state', () => {
  it('shows a health-check outage as unavailable instead of unconfigured', () => {
    render(<SettingsManager />);

    expect(screen.getByText('状态暂时不可用')).toBeInTheDocument();
    expect(screen.getByText(/暂时无法确认服务状态/)).toBeInTheDocument();
    expect(screen.getByText('状态未知')).toBeInTheDocument();
    expect(screen.queryByText('未配置')).not.toBeInTheDocument();
  });
});
