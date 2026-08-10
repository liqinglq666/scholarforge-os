import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsManager } from '@/components/settings/settings-manager';
import { MAX_BACKUP_BYTES } from '@/lib/config';
import { createBackup, createDraft, createPersistedWorkspace, createWorkspaceState } from '@/lib/workspace/schema';

const workspaceMock = vi.hoisted(() => ({
  getData: vi.fn(),
  replaceData: vi.fn(),
}));
const storageMock = vi.hoisted(() => ({
  clear: vi.fn(),
  write: vi.fn(),
}));
const routerMock = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
}));

vi.mock('@/components/workspace/use-workspace', () => ({
  useWorkspace: () => ({
    data: workspaceMock.getData(),
    ready: true,
    replaceData: workspaceMock.replaceData,
  }),
}));

vi.mock('@/components/review/use-review-service-status', () => ({
  useReviewServiceStatus: () => ({
    status: {
      configured: true,
      model: 'qwen-plus',
      message: '分析服务可用。',
      limits: { maxCharacters: 12_000, maxRequestBytes: 80_000, requestsPerWindow: 8, windowMinutes: 10 },
    },
    loading: false,
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

vi.mock('@/lib/workspace/storage', () => ({
  clearWorkspaceData: storageMock.clear,
  writeWorkspaceData: storageMock.write,
}));

describe('SettingsManager', () => {
  beforeEach(() => {
    workspaceMock.getData.mockReset();
    workspaceMock.replaceData.mockReset();
    storageMock.clear.mockReset();
    storageMock.write.mockReset();
    routerMock.push.mockReset();
    workspaceMock.getData.mockReturnValue(createPersistedWorkspace());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('validates an imported backup before confirmation and does not replace local data until accepted', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const imported = createPersistedWorkspace();
    imported.current = createWorkspaceState(createDraft({
      projectName: 'Imported task',
      sourceText: 'Imported manuscript text remains protected until explicit confirmation. '.repeat(2),
    }));
    const backupText = JSON.stringify(createBackup(imported));
    const file = {
      name: 'scholarforge-workspace.json',
      type: 'application/json',
      size: new Blob([backupText]).size,
      text: vi.fn().mockResolvedValue(backupText),
    };
    render(<SettingsManager />);

    const input = screen.getByLabelText('导入备份') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    const dialog = await screen.findByRole('dialog', { name: '确认替换当前本地数据？' });
    expect(within(dialog).getByText(/Imported task/)).toBeInTheDocument();
    expect(storageMock.write).not.toHaveBeenCalled();
    expect(workspaceMock.replaceData).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole('button', { name: '确认导入' }));

    await waitFor(() => expect(storageMock.write).toHaveBeenCalledTimes(1));
    expect(workspaceMock.replaceData).toHaveBeenCalledWith(expect.objectContaining({
      current: expect.objectContaining({
        draft: expect.objectContaining({ projectName: 'Imported task' }),
      }),
    }));
  });

  it('rejects an oversized backup without reading it or opening the replacement dialog', async () => {
    const readText = vi.fn().mockResolvedValue('should not be read');
    const file = {
      name: 'oversized.json',
      type: 'application/json',
      size: MAX_BACKUP_BYTES + 1,
      text: readText,
    };
    render(<SettingsManager />);

    const input = screen.getByLabelText('导入备份') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText(/备份文件超过 8 MB 限制/)).toBeInTheDocument();
    expect(readText).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: '确认替换当前本地数据？' })).not.toBeInTheDocument();
    expect(storageMock.write).not.toHaveBeenCalled();
    expect(workspaceMock.replaceData).not.toHaveBeenCalled();
  });

  it('does not clear browser data until the destructive confirmation is accepted', async () => {
    render(<SettingsManager />);

    await userEvent.click(screen.getByRole('button', { name: '清除此浏览器数据' }));
    let dialog = screen.getByRole('dialog', { name: '清除此浏览器中的全部数据？' });
    expect(storageMock.clear).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole('button', { name: '保留数据' }));
    expect(storageMock.clear).not.toHaveBeenCalled();
    expect(routerMock.push).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: '清除此浏览器数据' }));
    dialog = screen.getByRole('dialog', { name: '清除此浏览器中的全部数据？' });
    await userEvent.click(within(dialog).getByRole('button', { name: '确认清除' }));

    expect(storageMock.clear).toHaveBeenCalledTimes(1);
    expect(workspaceMock.replaceData).toHaveBeenCalledTimes(1);
    expect(routerMock.push).toHaveBeenCalledWith('/workspace');
  });
});
