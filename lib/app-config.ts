import type { AgentId, IssueDecision, ReviewMode, ReviewSection, WorkspaceTask } from '@/lib/types';

export const APP_VERSION = '1.5.0';
export const APP_NAME = 'ScholarForge OS';
export const MAX_HISTORY = 8;
export const WORKSPACE_TEXT_LIMIT = 12_000;

export const STORAGE_KEYS = {
  draft: 'scholarforge-os-paperlens-draft-v1',
  history: 'scholarforge-os-paperlens-history-v1',
  hubView: 'scholarforge-os-hub-view-v1',
  authorEditingSession: 'scholarforge-os-author-editing-session-v1',
  lastImport: 'scholarforge-os-document-import-v1',
} as const;

export const WORKFLOW_LABELS: Record<WorkspaceTask, string> = {
  translate: '科研中译英',
  polish: '英文保守润色',
  precheck: '投稿前预检',
  'review-response': '审稿回复助手',
};

export const WORKFLOW_DESCRIPTIONS: Record<WorkspaceTask, string> = {
  translate: '把中文科研内容转成可核对的学术英文，保持术语、数值与证据强度。',
  polish: '保守改善英文语法、搭配和学术语气，不新增科研事实。',
  precheck: '从术语、语言、逻辑与方法四个维度检查投稿准备度。',
  'review-response': '基于作者提供的依据起草正式返修信，不虚构实验与修改位置。',
};

export const SECTION_LABELS: Record<ReviewSection, string> = {
  general: '通用段落',
  abstract: '摘要',
  introduction: '引言',
  methods: '方法',
  results: '结果',
  discussion: '讨论',
  conclusion: '结论',
};

export const MODE_LABELS: Record<ReviewMode, string> = {
  conservative: '保守模式',
  balanced: '平衡模式',
  deep: '深度模式',
};

export const DECISION_LABELS: Record<IssueDecision, string> = {
  pending: '待处理',
  accepted: '接受',
  deferred: '保留待定',
  dismissed: '拒绝',
};

export const AGENT_LABELS: Record<AgentId, string> = {
  terminology: '术语审校',
  language: '语言审校',
  logic: '逻辑审校',
  method: '方法审校',
};
