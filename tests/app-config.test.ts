import { describe, expect, it } from 'vitest';
import { APP_VERSION, DECISION_LABELS, STORAGE_KEYS } from '@/lib/app-config';

describe('app configuration', () => {
  it('uses one release version and preserves browser storage keys', () => {
    expect(APP_VERSION).toBe('1.5.0');
    expect(STORAGE_KEYS.draft).toBe('scholarforge-os-paperlens-draft-v1');
    expect(STORAGE_KEYS.history).toBe('scholarforge-os-paperlens-history-v1');
    expect(STORAGE_KEYS.hubView).toBe('scholarforge-os-hub-view-v1');
    expect(STORAGE_KEYS.authorEditingSession).toBe('scholarforge-os-author-editing-session-v1');
  });

  it('uses author-facing decision labels without changing serialized values', () => {
    expect(DECISION_LABELS).toEqual({ pending: '待处理', accepted: '接受', deferred: '保留待定', dismissed: '拒绝' });
  });
});
