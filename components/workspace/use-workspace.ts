'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_HISTORY_ENTRIES } from '@/lib/config';
import type { PersistedWorkspace, WorkspaceState } from '@/lib/types';
import { createHistoryEntry, createPersistedWorkspace } from '@/lib/workspace/schema';
import { readWorkspaceData, writeWorkspaceData } from '@/lib/workspace/storage';

export type SaveState = 'loading' | 'saved' | 'saving' | 'error';

export function useWorkspace() {
  const [data, setData] = useState<PersistedWorkspace>(() => createPersistedWorkspace());
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('loading');
  const [saveMessage, setSaveMessage] = useState('正在恢复本地工作区…');
  const skipNextSave = useRef(true);
  const latestData = useRef(data);
  const explicitlySavedData = useRef<PersistedWorkspace | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const restored = readWorkspaceData();
      latestData.current = restored;
      setData(restored);
      setReady(true);
      setSaveState('saved');
      setSaveMessage('已恢复本地工作区');
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (explicitlySavedData.current === data) {
      explicitlySavedData.current = null;
      setSaveState('saved');
      setSaveMessage('已保存到此浏览器');
      return;
    }
    setSaveState('saving');
    setSaveMessage('正在保存…');
    const timer = window.setTimeout(() => {
      try {
        const next = { ...data, updatedAt: new Date().toISOString() };
        writeWorkspaceData(next);
        latestData.current = next;
        setSaveState('saved');
        setSaveMessage('已保存到此浏览器');
      } catch (error) {
        setSaveState('error');
        setSaveMessage(error instanceof Error ? error.message : '自动保存失败，请导出备份。');
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [data, ready]);

  useEffect(() => {
    latestData.current = data;
  }, [data]);

  useEffect(() => {
    if (!ready) return;
    return () => {
      try {
        writeWorkspaceData(latestData.current);
      } catch {
        // The visible save state already explains storage failures while mounted.
      }
    };
  }, [ready]);

  const updateCurrent = useCallback((update: WorkspaceState | ((current: WorkspaceState) => WorkspaceState)) => {
    setData((previous) => {
      const current = typeof update === 'function' ? update(previous.current) : update;
      const history = current.currentResult
        ? [createHistoryEntry(current), ...previous.history.filter((entry) => entry.id !== current.currentResult?.id)].slice(0, MAX_HISTORY_ENTRIES)
        : previous.history;
      const next = { ...previous, current, history, updatedAt: new Date().toISOString() };
      latestData.current = next;
      return next;
    });
  }, []);

  const replaceData = useCallback((next: PersistedWorkspace) => {
    skipNextSave.current = false;
    latestData.current = next;
    setData(next);
  }, []);

  const saveNow = useCallback((nextData: PersistedWorkspace) => {
    try {
      writeWorkspaceData(nextData);
      latestData.current = nextData;
      explicitlySavedData.current = nextData;
      setSaveState('saved');
      setSaveMessage('已保存到此浏览器');
      return true;
    } catch (error) {
      setSaveState('error');
      setSaveMessage(error instanceof Error ? error.message : '保存失败，请导出备份。');
      return false;
    }
  }, []);

  return { data, ready, saveState, saveMessage, updateCurrent, replaceData, saveNow };
}
