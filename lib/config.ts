import type { SectionType, TaskType } from '@/lib/types';

export const APP_NAME = 'ScholarForge OS';
export const APP_VERSION = '2.3.0';
export const WORKSPACE_STORAGE_KEY = 'scholarforge.workspace.v2';
export const LEGACY_DRAFT_KEY = 'scholarforge-os-paperlens-draft-v1';
export const LEGACY_HISTORY_KEY = 'scholarforge-os-paperlens-history-v1';
export const MAX_SOURCE_CHARACTERS = 12_000;
export const MIN_SOURCE_CHARACTERS = 40;
export const MAX_REQUEST_BYTES = 80_000;
export const MAX_MODEL_OUTPUT_CHARACTERS = 100_000;
export const MAX_HISTORY_ENTRIES = 12;
export const MAX_BACKUP_BYTES = 2_000_000;
export const MAX_DOCX_BYTES = 8_000_000;
export const MAX_TERMINOLOGY_LOCKS = 20;
export const MODEL_TIMEOUT_MS = 55_000;

export const TASK_LABELS: Record<TaskType, string> = {
  translate: '科研中译英',
  polish: '英文保守润色',
  precheck: '投稿前检查',
};

export const TASK_DESCRIPTIONS: Record<TaskType, string> = {
  translate: '把中文科研内容转换为可逐项核对的学术英文，保护数值、术语和证据强度。',
  polish: '改善英文语法、句法和学术表达，不新增事实，不扩大结论。',
  precheck: '识别语言、术语、逻辑、方法报告和证据边界问题，由作者逐条决定。',
};

export const SECTION_LABELS: Record<SectionType, string> = {
  general: '通用段落',
  abstract: '摘要',
  introduction: '引言',
  methods: '方法',
  results: '结果',
  discussion: '讨论',
  conclusion: '结论',
};

export const SECTION_OPTIONS = Object.entries(SECTION_LABELS) as Array<[SectionType, string]>;
