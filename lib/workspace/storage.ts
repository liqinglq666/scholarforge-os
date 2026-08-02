'use client';

import { MAX_HISTORY_ENTRIES, WORKSPACE_STORAGE_KEY } from '@/lib/config';
import type { PersistedWorkspace, WorkspaceState } from '@/lib/types';
import {
  createHistoryEntry,
  createPersistedWorkspace,
  migrateLegacyWorkspace,
  parsePersistedWorkspace,
} from '@/lib/workspace/schema';

export class WorkspaceStorageError extends Error {}

function getBrowserStorage() {
  if (typeof window === 'undefined') return null;
  try {
    const testKey = 'scholarforge.storage-test';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readWorkspaceData(): PersistedWorkspace {
  const storage = getBrowserStorage();
  if (!storage) return createPersistedWorkspace();
  let raw: string | null;
  try {
    raw = storage.getItem(WORKSPACE_STORAGE_KEY);
  } catch {
    return createPersistedWorkspace();
  }
  if (raw) {
    try { return parsePersistedWorkspace(JSON.parse(raw) as unknown); } catch { return createPersistedWorkspace(); }
  }
  let migrated = null;
  try {
    migrated = migrateLegacyWorkspace(storage);
  } catch {
    return createPersistedWorkspace();
  }
  if (migrated) {
    try { storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(migrated)); } catch { /* surfaced on the next explicit save */ }
    return migrated;
  }
  return createPersistedWorkspace();
}

export function writeWorkspaceData(data: PersistedWorkspace) {
  const storage = getBrowserStorage();
  if (!storage) throw new WorkspaceStorageError('浏览器本地存储不可用。当前内容仍保留在页面中，请立即导出备份。');
  try {
    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(parsePersistedWorkspace(data)));
  } catch {
    throw new WorkspaceStorageError('自动保存失败，可能是浏览器存储空间不足。当前内容仍保留在页面中，请导出备份。');
  }
}

export function persistCurrentWorkspace(data: PersistedWorkspace, current: WorkspaceState) {
  const now = new Date().toISOString();
  const next: PersistedWorkspace = {
    version: 3,
    current: { ...current, savedAt: now },
    history: data.history,
    projects: data.projects,
    ...(data.activeProjectId ? { activeProjectId: data.activeProjectId } : {}),
    preferences: data.preferences,
    updatedAt: now,
  };
  writeWorkspaceData(next);
  return next;
}

export function archiveWorkspace(data: PersistedWorkspace, current: WorkspaceState) {
  const entry = createHistoryEntry(current);
  const history = [entry, ...data.history.filter((item) => item.id !== entry.id)].slice(0, MAX_HISTORY_ENTRIES);
  const next: PersistedWorkspace = {
    version: 3,
    current: { ...current, savedAt: entry.savedAt },
    history,
    projects: data.projects,
    ...(data.activeProjectId ? { activeProjectId: data.activeProjectId } : {}),
    preferences: data.preferences,
    updatedAt: entry.savedAt,
  };
  writeWorkspaceData(next);
  return next;
}

export function clearWorkspaceData() {
  const storage = getBrowserStorage();
  if (!storage) throw new WorkspaceStorageError('浏览器本地存储不可用，无法清除数据。');
  storage.removeItem(WORKSPACE_STORAGE_KEY);
}
