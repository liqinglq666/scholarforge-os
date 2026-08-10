import { describe, expect, it, vi } from 'vitest';
import { MAX_BACKUP_BYTES } from '@/lib/config';
import { readWorkspaceBackupFile, type WorkspaceBackupFile } from '@/lib/workspace/backup-file';
import { createBackup, createPersistedWorkspace } from '@/lib/workspace/schema';

function backupFile(overrides: Partial<WorkspaceBackupFile> = {}): WorkspaceBackupFile {
  const text = JSON.stringify(createBackup(createPersistedWorkspace()));
  return {
    name: 'scholarforge-workspace.json',
    type: 'application/json',
    size: new Blob([text]).size,
    text: vi.fn().mockResolvedValue(text),
    ...overrides,
  };
}

describe('workspace backup file preflight', () => {
  it('rejects an oversized backup before reading its text', async () => {
    const readText = vi.fn().mockResolvedValue('should not be read');
    const file = backupFile({ size: MAX_BACKUP_BYTES + 1, text: readText });

    await expect(readWorkspaceBackupFile(file)).rejects.toThrow(/超过 8 MB/);
    expect(readText).not.toHaveBeenCalled();
  });

  it('rejects an empty backup before reading its text', async () => {
    const readText = vi.fn().mockResolvedValue('');
    const file = backupFile({ size: 0, text: readText });

    await expect(readWorkspaceBackupFile(file)).rejects.toThrow(/为空/);
    expect(readText).not.toHaveBeenCalled();
  });

  it('rejects a labeled ScholarForge backup that is missing the current workspace', async () => {
    const text = JSON.stringify({
      format: 'scholarforge-workspace',
      version: 3,
      history: [],
      projects: [],
      preferences: {},
    });
    const file = backupFile({ size: new Blob([text]).size, text: vi.fn().mockResolvedValue(text) });

    await expect(readWorkspaceBackupFile(file)).rejects.toThrow(/缺少有效的当前工作区/);
  });

  it('accepts a current valid exported backup and returns its sanitized preview', async () => {
    const data = createPersistedWorkspace();
    data.current.draft.projectName = 'Backup import test';
    const text = JSON.stringify(createBackup(data));
    const file = backupFile({ size: new Blob([text]).size, text: vi.fn().mockResolvedValue(text) });

    const preview = await readWorkspaceBackupFile(file);

    expect(preview.version).toBe(3);
    expect(preview.current.draft.projectName).toBe('Backup import test');
  });
});
