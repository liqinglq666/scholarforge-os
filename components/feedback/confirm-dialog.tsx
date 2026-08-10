'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

export function ConfirmDialog({
  open,
  eyebrow = '操作确认',
  title,
  description,
  confirmLabel = '确认',
  cancelLabel = '取消',
  tone = 'default',
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  eyebrow?: string;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      cancelButtonRef.current?.focus();
      return;
    }

    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      className={`confirm-dialog${tone === 'danger' ? ' confirm-dialog-danger' : ''}`}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
      ref={dialogRef}
    >
      <form method="dialog" onSubmit={(event) => event.preventDefault()}>
        <span className="product-label">{eyebrow}</span>
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{description}</p>
        {children}
        <div className="dialog-actions">
          <button onClick={onCancel} ref={cancelButtonRef} type="button">{cancelLabel}</button>
          <button className={tone === 'danger' ? 'danger-button' : 'primary-button'} onClick={onConfirm} type="button">{confirmLabel}</button>
        </div>
      </form>
    </dialog>
  );
}
