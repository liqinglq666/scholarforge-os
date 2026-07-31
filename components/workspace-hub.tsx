'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { DocumentImportDialog } from '@/components/document-import-dialog';
import { ProjectHub } from '@/components/project-hub/project-hub';
import { EvidenceWorkbench } from '@/components/workbench/evidence-workbench';
import { STORAGE_KEYS } from '@/lib/app-config';
import {
  createWorkspaceBackup,
  parseWorkspaceBackup,
  readWorkspaceState,
  upsertSnapshot,
  writeWorkspaceDraft,
  writeWorkspaceHistory,
} from '@/lib/workspace-store';
import type { ReviewSnapshot, WorkspaceDraft, WorkspaceState } from '@/lib/workspace-schema';
import type { WorkspaceTask } from '@/lib/types';

type View = 'hub' | 'workbench';
type ServiceState = 'checking' | 'ready' | 'unconfigured' | 'offline';

function defaultDraft(task: WorkspaceTask): WorkspaceDraft {
  return {
    projectTitle: '未命名科研写作任务',
    taskType: task,
    sourceText: '',
    targetJournal: '',
    sectionType: task === 'translate' ? 'abstract' : 'methods',
    lockedTerms: [],
    savedAt: new Date().toISOString(),
  };
}

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function WorkspaceHub() {
  const [state, setState] = useState<WorkspaceState>({ draft: null, history: [], warnings: [] });
  const [view, setView] = useState<View>('hub');
  const [activeSnapshot, setActiveSnapshot] = useState<ReviewSnapshot | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [serviceState, setServiceState] = useState<ServiceState>('checking');
  const backupInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    setState(readWorkspaceState(window.localStorage));
  }, []);

  useEffect(() => {
    refresh();
    if (window.sessionStorage.getItem(STORAGE_KEYS.hubView) === 'workbench') setView('workbench');

    let alive = true;
    fetch('/api/health', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Health check failed');
        return response.json() as Promise<{ analysisConfigured?: boolean }>;
      })
      .then((payload) => {
        if (!alive) return;
        setServiceState(payload.analysisConfigured ? 'ready' : 'unconfigured');
      })
      .catch(() => alive && setServiceState('offline'));

    return () => { alive = false; };
  }, [refresh]);

  const saveDraft = useCallback((draft: WorkspaceDraft) => {
    try {
      writeWorkspaceDraft(window.localStorage, draft);
      setState((current) => ({ ...current, draft }));
    } catch {
      setState((current) => ({
        ...current,
        warnings: Array.from(new Set([
          ...current.warnings,
          '浏览器阻止了本地保存，当前内容仅保留在本次页面中。',
        ])),
      }));
    }
  }, []);

  const saveSnapshot = useCallback((snapshot: ReviewSnapshot) => {
    try {
      const history = upsertSnapshot(window.localStorage, snapshot);
      setState((current) => ({ ...current, history }));
      setActiveSnapshot(snapshot);
    } catch {
      setState((current) => ({
        ...current,
        warnings: Array.from(new Set([
          ...current.warnings,
          '任务历史保存失败，当前结果仍可继续使用。',
        ])),
      }));
    }
  }, []);

  function openDraft(draft: WorkspaceDraft, snapshot: ReviewSnapshot | null = null) {
    saveDraft(draft);
    setActiveSnapshot(snapshot);
    setView('workbench');
    window.sessionStorage.setItem(STORAGE_KEYS.hubView, 'workbench');
    window.scrollTo({ top: 0 });
  }

  function createTask(task: WorkspaceTask) {
    openDraft(defaultDraft(task));
  }

  function openSnapshot(snapshot: ReviewSnapshot) {
    openDraft({
      projectTitle: snapshot.projectTitle,
      taskType: snapshot.taskType,
      sourceText: snapshot.sourceText,
      targetJournal: snapshot.targetJournal,
      sectionType: snapshot.sectionType,
      lockedTerms: snapshot.lockedTerms,
      savedAt: new Date().toISOString(),
    }, snapshot);
  }

  function returnToHub() {
    setView('hub');
    setActiveSnapshot(null);
    window.sessionStorage.setItem(STORAGE_KEYS.hubView, 'hub');
    refresh();
    window.scrollTo({ top: 0 });
  }

  function deleteSnapshot(snapshot: ReviewSnapshot) {
    if (!window.confirm(`删除“${snapshot.projectTitle}”的本地任务记录？`)) return;
    const next = state.history.filter((item) => item.id !== snapshot.id);
    writeWorkspaceHistory(window.localStorage, next);
    setState((current) => ({ ...current, history: next }));
  }

  function exportBackup() {
    downloadJson(
      `scholarforge-backup-${new Date().toISOString().slice(0, 10)}.json`,
      createWorkspaceBackup(window.localStorage),
    );
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const backup = parseWorkspaceBackup(JSON.parse(await file.text()) as unknown);
      if (!window.confirm(`恢复 ${backup.history.length} 条历史记录，并替换当前本地草稿？`)) return;
      writeWorkspaceDraft(window.localStorage, backup.draft);
      writeWorkspaceHistory(window.localStorage, backup.history);
      refresh();
    } catch (caught) {
      setState((current) => ({
        ...current,
        warnings: [
          ...current.warnings,
          caught instanceof Error ? caught.message : '备份恢复失败。',
        ],
      }));
    }
  }

  function clearData() {
    if (!window.confirm('清除当前浏览器中的草稿和任务历史？此操作无法撤销。')) return;
    window.localStorage.removeItem(STORAGE_KEYS.draft);
    window.localStorage.removeItem(STORAGE_KEYS.history);
    window.localStorage.removeItem(STORAGE_KEYS.authorEditingSession);
    setState({ draft: null, history: [], warnings: [] });
  }

  if (view === 'workbench') {
    const draft = state.draft || defaultDraft('precheck');
    return <>
      <EvidenceWorkbench
        initialDraft={draft}
        initialSnapshot={activeSnapshot}
        key={activeSnapshot?.id || `${draft.taskType}-${draft.savedAt || 'draft'}`}
        onBack={returnToHub}
        onDraftSaved={saveDraft}
        onImport={() => setImportOpen(true)}
        onSnapshotChanged={saveSnapshot}
      />
      <DocumentImportDialog
        existingDraft={state.draft}
        onClose={() => setImportOpen(false)}
        onImported={(next) => openDraft(next)}
        open={importOpen}
      />
    </>;
  }

  return <>
    <ProjectHub
      draft={state.draft}
      history={state.history}
      onClearData={clearData}
      onCreate={createTask}
      onDeleteSnapshot={deleteSnapshot}
      onExportBackup={exportBackup}
      onImport={() => setImportOpen(true)}
      onImportBackup={() => backupInputRef.current?.click()}
      onOpenDraft={() => state.draft && openDraft(state.draft)}
      onOpenSnapshot={openSnapshot}
      serviceState={serviceState}
      warnings={state.warnings}
    />
    <input
      accept="application/json,.json"
      hidden
      onChange={(event) => void importBackup(event)}
      ref={backupInputRef}
      type="file"
    />
    <DocumentImportDialog
      existingDraft={state.draft}
      onClose={() => setImportOpen(false)}
      onImported={(next) => openDraft(next)}
      open={importOpen}
    />
  </>;
}
