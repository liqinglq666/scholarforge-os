import type {
  AcademicStage,
  EnglishVariant,
  ExplanationLevel,
  SectionType,
  TaskType,
  UserPreferences,
} from '@/lib/types';
import { isRecord } from '@/lib/validation/common';
import { parseUserPreferences } from '@/lib/workspace/schema';

const ACADEMIC_STAGES = new Set<AcademicStage>(['masters', 'doctoral', 'postgraduate', 'researcher', 'other']);
const ENGLISH_VARIANTS = new Set<EnglishVariant>(['us', 'uk']);
const EXPLANATION_LEVELS = new Set<ExplanationLevel>(['brief', 'balanced', 'detailed']);
const TASK_TYPES = new Set<TaskType>(['translate', 'polish', 'precheck']);
const SECTION_TYPES = new Set<SectionType>(['general', 'abstract', 'introduction', 'methods', 'results', 'discussion', 'conclusion']);

const WRITABLE_FIELDS = [
  'displayName',
  'discipline',
  'academicStage',
  'englishVariant',
  'explanationLevel',
  'defaultTaskType',
  'defaultSectionType',
  'defaultTargetJournal',
  'customWritingRules',
  'chapterTemplate',
] as const;

export class CloudPreferencesValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CloudPreferencesValidationError';
  }
}

function invalid(field: string): never {
  throw new CloudPreferencesValidationError(`偏好字段“${field}”格式无效。`);
}

function validateString(value: Record<string, unknown>, field: string) {
  if (field in value && typeof value[field] !== 'string') invalid(field);
}

function validateEnum<T extends string>(
  value: Record<string, unknown>,
  field: string,
  allowed: Set<T>,
) {
  if (field in value && (typeof value[field] !== 'string' || !allowed.has(value[field] as T))) invalid(field);
}

function validateRules(value: Record<string, unknown>) {
  if (!('customWritingRules' in value)) return;
  const rules = value.customWritingRules;
  if (!Array.isArray(rules) || rules.length > 30) invalid('customWritingRules');
  for (const rule of rules) {
    if (!isRecord(rule)) invalid('customWritingRules');
    if (typeof rule.source !== 'string' || !rule.source.trim()) invalid('customWritingRules');
    if (typeof rule.preferred !== 'string' || !rule.preferred.trim()) invalid('customWritingRules');
    if ('id' in rule && typeof rule.id !== 'string') invalid('customWritingRules');
    if ('note' in rule && typeof rule.note !== 'string') invalid('customWritingRules');
  }
}

function validateChapterTemplate(value: Record<string, unknown>) {
  if (!('chapterTemplate' in value)) return;
  const chapters = value.chapterTemplate;
  if (!Array.isArray(chapters) || chapters.length < 1 || chapters.length > 12) invalid('chapterTemplate');
  for (const chapter of chapters) {
    if (!isRecord(chapter)) invalid('chapterTemplate');
    if (typeof chapter.title !== 'string' || !chapter.title.trim()) invalid('chapterTemplate');
    if (typeof chapter.sectionType !== 'string' || !SECTION_TYPES.has(chapter.sectionType as SectionType)) invalid('chapterTemplate');
    if ('id' in chapter && typeof chapter.id !== 'string') invalid('chapterTemplate');
  }
}

export function parseCloudPreferencesWrite(value: unknown): UserPreferences {
  if (!isRecord(value)) {
    throw new CloudPreferencesValidationError('偏好数据必须是对象。');
  }
  if (!WRITABLE_FIELDS.some((field) => field in value)) {
    throw new CloudPreferencesValidationError('请求中没有可保存的偏好字段。');
  }

  validateString(value, 'displayName');
  validateString(value, 'discipline');
  validateString(value, 'defaultTargetJournal');
  validateEnum(value, 'academicStage', ACADEMIC_STAGES);
  validateEnum(value, 'englishVariant', ENGLISH_VARIANTS);
  validateEnum(value, 'explanationLevel', EXPLANATION_LEVELS);
  validateEnum(value, 'defaultTaskType', TASK_TYPES);
  validateEnum(value, 'defaultSectionType', SECTION_TYPES);
  if ('updatedAt' in value && typeof value.updatedAt !== 'string') invalid('updatedAt');
  validateRules(value);
  validateChapterTemplate(value);

  return parseUserPreferences(value);
}
