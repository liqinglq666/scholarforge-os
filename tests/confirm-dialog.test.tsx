import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';

const originalShowModal = HTMLDialogElement.prototype.showModal;
const originalClose = HTMLDialogElement.prototype.close;

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.removeAttribute('open');
    },
  });
});

afterAll(() => {
  if (originalShowModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: originalShowModal });
  else delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
  if (originalClose) Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: originalClose });
  else delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
});

describe('ConfirmDialog', () => {
  it('opens as an accessible dialog and focuses the safe action first', () => {
    render(
      <ConfirmDialog
        description="删除后无法撤销。"
        onCancel={() => undefined}
        onConfirm={() => undefined}
        open
        title="删除最近任务？"
        tone="danger"
      />,
    );

    expect(screen.getByRole('dialog')).toHaveAccessibleName('删除最近任务？');
    expect(screen.getByRole('button', { name: '取消' })).toHaveFocus();
  });

  it('runs the explicit confirm action without relying on a browser confirm prompt', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        confirmLabel="确认删除"
        description="删除后无法撤销。"
        onCancel={() => undefined}
        onConfirm={onConfirm}
        open
        title="删除最近任务？"
        tone="danger"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('routes Escape and backdrop dismissal through the controlled cancel action', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        description="当前工作会先被保存。"
        onCancel={onCancel}
        onConfirm={() => undefined}
        open
        title="恢复最近任务？"
      />,
    );

    const dialog = screen.getByRole('dialog');
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    fireEvent.mouseDown(dialog);
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
