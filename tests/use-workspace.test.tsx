import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useWorkspace } from '@/components/workspace/use-workspace';
import { createPersistedWorkspace } from '@/lib/workspace/schema';
import { readWorkspaceData, writeWorkspaceData } from '@/lib/workspace/storage';

vi.mock('@/lib/workspace/storage', () => ({
  readWorkspaceData: vi.fn(),
  writeWorkspaceData: vi.fn(),
}));

const mockedReadWorkspaceData = vi.mocked(readWorkspaceData);
const mockedWriteWorkspaceData = vi.mocked(writeWorkspaceData);

beforeEach(() => {
  vi.useFakeTimers();
  mockedReadWorkspaceData.mockReset();
  mockedWriteWorkspaceData.mockReset();
  mockedReadWorkspaceData.mockReturnValue(createPersistedWorkspace());
});

afterEach(() => {
  vi.useRealTimers();
});

async function restoreWorkspace() {
  const hook = renderHook(() => useWorkspace());
  await act(async () => {
    vi.runOnlyPendingTimers();
  });
  expect(hook.result.current.ready).toBe(true);
  return hook;
}

test('does not autosave the same workspace again after an explicit save', async () => {
  const { result } = await restoreWorkspace();
  mockedWriteWorkspaceData.mockClear();

  const next = {
    ...result.current.data,
    preferences: { ...result.current.data.preferences, displayName: 'Saved author' },
    updatedAt: '2026-08-10T05:00:00.000Z',
  };

  act(() => {
    result.current.replaceData(next);
    expect(result.current.saveNow(next)).toBe(true);
  });

  expect(mockedWriteWorkspaceData).toHaveBeenCalledTimes(1);
  expect(mockedWriteWorkspaceData).toHaveBeenLastCalledWith(next);

  await act(async () => {
    vi.advanceTimersByTime(600);
  });

  expect(mockedWriteWorkspaceData).toHaveBeenCalledTimes(1);
});

test('keeps the explicitly saved workspace as the latest unmount snapshot', async () => {
  const { result, unmount } = await restoreWorkspace();
  mockedWriteWorkspaceData.mockClear();

  const next = {
    ...result.current.data,
    preferences: { ...result.current.data.preferences, discipline: 'Environmental Engineering' },
    updatedAt: '2026-08-10T05:01:00.000Z',
  };

  act(() => {
    result.current.replaceData(next);
    expect(result.current.saveNow(next)).toBe(true);
    unmount();
  });

  expect(mockedWriteWorkspaceData).toHaveBeenCalled();
  expect(mockedWriteWorkspaceData).toHaveBeenLastCalledWith(next);
});
