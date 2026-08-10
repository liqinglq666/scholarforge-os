import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadBlob } from '@/lib/exports/files';
import { runExportAction } from '@/lib/exports/run';

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  if (originalCreateObjectURL) {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: originalCreateObjectURL });
  } else {
    Reflect.deleteProperty(URL, 'createObjectURL');
  }
  if (originalRevokeObjectURL) {
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: originalRevokeObjectURL });
  } else {
    Reflect.deleteProperty(URL, 'revokeObjectURL');
  }
  document.body.innerHTML = '';
});

describe('export execution', () => {
  it('reports success after a synchronous export action completes', async () => {
    const action = vi.fn();

    const result = await runExportAction(action, '文件已生成并发起下载。');

    expect(action).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true, message: '文件已生成并发起下载。' });
  });

  it('turns an asynchronous export error into visible user feedback', async () => {
    const action = vi.fn(async () => {
      throw new Error('DOCX 生成器不可用');
    });

    const result = await runExportAction(action, '不会使用这条成功文案');

    expect(result).toEqual({ ok: false, message: '导出失败：DOCX 生成器不可用' });
  });

  it('uses a stable fallback when the export throws a non-Error value', async () => {
    const result = await runExportAction(() => Promise.reject('blocked'), '不会使用这条成功文案');

    expect(result).toEqual({ ok: false, message: '导出失败，请重试。' });
  });

  it('cleans the temporary anchor and object URL even when browser download initiation throws', () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => 'blob:scholarforge-test');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: revokeObjectURL });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('downloads blocked');
    });

    expect(() => downloadBlob(new Blob(['author draft']), 'draft.txt')).toThrow('downloads blocked');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(document.body.querySelector('a')).toBeNull();

    vi.advanceTimersByTime(1_000);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:scholarforge-test');
  });
});
