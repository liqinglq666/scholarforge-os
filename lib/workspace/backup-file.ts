import { MAX_BACKUP_BYTES } from '@/lib/config';
import type { WorkspaceBackup } from '@/lib/types';
import { isRecord } from '@/lib/validation/common';
import { parseBackupText } from '@/lib/workspace/schema';

export type WorkspaceBackupFile = Pick<File, 'name' | 'size' | 'type' | 'text'>;

function validateBackupEnvelope(text: string) {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    throw new Error('备份文件不是有效 JSON。');
  }

  if (!isRecord(raw) || raw.format !== 'scholarforge-workspace' || (raw.version !== 2 && raw.version !== 3)) {
    throw new Error('这不是受支持的 ScholarForge 工作区备份。');
  }
  if (!isRecord(raw.current) || raw.current.version !== 2 || !isRecord(raw.current.draft)) {
    throw new Error('备份缺少有效的当前工作区，已拒绝导入。');
  }
  if ('history' in raw && !Array.isArray(raw.history)) {
    throw new Error('备份中的历史记录结构无效，已拒绝导入。');
  }
  if (raw.version === 3 && 'projects' in raw && !Array.isArray(raw.projects)) {
    throw new Error('备份中的论文项目结构无效，已拒绝导入。');
  }
  if ('preferences' in raw && !isRecord(raw.preferences)) {
    throw new Error('备份中的个性化偏好结构无效，已拒绝导入。');
  }
}

export async function readWorkspaceBackupFile(file: WorkspaceBackupFile): Promise<WorkspaceBackup> {
  if (!/\.json$/i.test(file.name) && file.type && file.type !== 'application/json') {
    throw new Error('仅支持 ScholarForge 导出的 .json 工作区备份。');
  }
  if (file.size <= 0) throw new Error('备份文件为空。当前工作区没有改变。');
  if (file.size > MAX_BACKUP_BYTES) throw new Error('备份文件超过 8 MB 限制。当前工作区没有改变。');

  const text = await file.text();
  validateBackupEnvelope(text);
  return parseBackupText(text);
}
