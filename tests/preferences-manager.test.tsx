import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PreferencesManager } from '@/components/settings/preferences-manager';
import { createPersistedWorkspace, createUserPreferences } from '@/lib/workspace/schema';

const workspaceMock = vi.hoisted(() => ({
  getData: vi.fn(),
  replaceData: vi.fn(),
  saveNow: vi.fn(() => true),
}));

vi.mock('@/components/workspace/use-workspace', () => ({
  useWorkspace: () => ({
    data: workspaceMock.getData(),
    ready: true,
    saveState: 'saved',
    saveMessage: '已保存到此浏览器',
    replaceData: workspaceMock.replaceData,
    saveNow: workspaceMock.saveNow,
  }),
}));

vi.mock('@/components/account/use-auth-status', () => ({
  useAuthStatus: () => ({
    status: {
      configured: true,
      authenticated: true,
      user: { email: 'researcher@example.com' },
      message: '已登录。',
    },
  }),
}));

describe('PreferencesManager', () => {
  beforeEach(() => {
    workspaceMock.replaceData.mockReset();
    workspaceMock.saveNow.mockReset();
    workspaceMock.saveNow.mockReturnValue(true);
    workspaceMock.getData.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps a custom chapter template until reset is explicitly confirmed', async () => {
    const data = createPersistedWorkspace();
    data.preferences = {
      ...data.preferences,
      chapterTemplate: [{ id: 'custom-template', title: 'Only custom chapter', sectionType: 'general' }],
    };
    workspaceMock.getData.mockReturnValue(data);
    render(<PreferencesManager />);

    await waitFor(() => expect(screen.getByLabelText('模板章节 1 名称')).toHaveValue('Only custom chapter'));
    await userEvent.click(screen.getByRole('button', { name: '恢复标准模板' }));

    let dialog = screen.getByRole('dialog', { name: '恢复标准章节模板？' });
    expect(screen.getByLabelText('模板章节 1 名称')).toHaveValue('Only custom chapter');
    await userEvent.click(within(dialog).getByRole('button', { name: '保留当前模板' }));
    expect(screen.getByLabelText('模板章节 1 名称')).toHaveValue('Only custom chapter');

    await userEvent.click(screen.getByRole('button', { name: '恢复标准模板' }));
    dialog = screen.getByRole('dialog', { name: '恢复标准章节模板？' });
    await userEvent.click(within(dialog).getByRole('button', { name: '恢复标准模板' }));

    expect(screen.getAllByLabelText(/模板章节 \d+ 名称/)).toHaveLength(createUserPreferences().chapterTemplate.length);
    expect(workspaceMock.replaceData).not.toHaveBeenCalled();
  });

  it('downloads and validates cloud preferences before asking permission, but does not replace local data until confirmed', async () => {
    const data = createPersistedWorkspace();
    data.preferences = { ...data.preferences, displayName: 'Local researcher' };
    workspaceMock.getData.mockReturnValue(data);
    const cloudPreferences = { ...createUserPreferences(), displayName: 'Cloud researcher' };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ preferences: cloudPreferences }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    render(<PreferencesManager />);

    await waitFor(() => expect(screen.getByLabelText('显示名称（可选）')).toHaveValue('Local researcher'));
    await userEvent.click(screen.getByRole('button', { name: '载入云端偏好' }));

    const dialog = await screen.findByRole('dialog', { name: '载入云端偏好？' });
    expect(fetchMock).toHaveBeenCalledWith('/api/preferences/cloud', { cache: 'no-store' });
    expect(screen.getByLabelText('显示名称（可选）')).toHaveValue('Local researcher');
    expect(workspaceMock.replaceData).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole('button', { name: '用云端偏好替换' }));

    expect(screen.getByLabelText('显示名称（可选）')).toHaveValue('Cloud researcher');
    expect(workspaceMock.replaceData).toHaveBeenCalledWith(expect.objectContaining({
      preferences: expect.objectContaining({ displayName: 'Cloud researcher' }),
    }));
    expect(workspaceMock.saveNow).toHaveBeenCalledTimes(1);
  });
});
