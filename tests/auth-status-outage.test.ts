import { describe, expect, it } from 'vitest';
import { preserveAuthStatusDuringOutage } from '@/components/account/use-auth-status';
import type { AuthStatus } from '@/lib/types';

describe('client auth outage status', () => {
  it('preserves the most recently confirmed authenticated identity', () => {
    const confirmed: AuthStatus = {
      configured: true,
      authenticated: true,
      user: {
        id: '00000000-0000-4000-8000-000000000001',
        email: 'researcher@example.com',
        displayName: 'Researcher',
      },
      message: '账户已登录。',
    };

    const unavailable = preserveAuthStatusDuringOutage(confirmed, '账户服务暂时不可用。');

    expect(unavailable).toEqual({
      configured: true,
      authenticated: true,
      user: confirmed.user,
      unavailable: true,
      message: '账户服务暂时不可用。',
    });
  });

  it('represents an unknown first-load failure as unavailable instead of unconfigured', () => {
    const unavailable = preserveAuthStatusDuringOutage(null);

    expect(unavailable.configured).toBe(true);
    expect(unavailable.authenticated).toBe(false);
    expect(unavailable.user).toBeNull();
    expect(unavailable.unavailable).toBe(true);
    expect(unavailable.message).toMatch(/暂时无法确认账户状态/);
  });
});
