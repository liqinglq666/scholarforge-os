import type { ReactNode } from 'react';

export function StatusBanner({
  tone = 'neutral',
  title,
  children,
}: {
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className={`status-banner tone-${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <span aria-hidden="true" className="status-mark" />
      <div><strong>{title}</strong>{children ? <p>{children}</p> : null}</div>
    </div>
  );
}
