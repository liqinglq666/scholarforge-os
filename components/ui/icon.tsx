import type { ReactNode } from 'react';

export type IconName =
  | 'arrow-left'
  | 'arrow-right'
  | 'check'
  | 'chevron-down'
  | 'clock'
  | 'close'
  | 'copy'
  | 'document'
  | 'download'
  | 'edit'
  | 'file'
  | 'folder'
  | 'history'
  | 'import'
  | 'menu'
  | 'minus'
  | 'more'
  | 'plus'
  | 'redo'
  | 'search'
  | 'shield'
  | 'spark'
  | 'trash'
  | 'undo'
  | 'warning';

const paths: Record<IconName, ReactNode> = {
  'arrow-left': <><path d="M19 12H5" /><path d="m11 18-6-6 6-6" /></>,
  'arrow-right': <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  close: <><path d="m6 6 12 12" /><path d="M18 6 6 18" /></>,
  copy: <><rect x="8" y="8" width="11" height="12" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h3" /></>,
  document: <><path d="M6 2h8l4 4v16H6z" /><path d="M14 2v5h5M9 12h6M9 16h6" /></>,
  download: <><path d="M12 3v12" /><path d="m7 10 5-5 5 5M4 21h16" /></>,
  edit: <><path d="m4 20 4.5-1 9.8-9.8-3.5-3.5L5 15.5z" /><path d="m13.8 6.7 3.5 3.5" /></>,
  file: <><path d="M6 2h8l4 4v16H6z" /><path d="M14 2v5h5" /></>,
  folder: <path d="M3 6h7l2 2h9v11H3z" />,
  history: <><path d="M4 7v5h5" /><path d="M5.5 16a8 8 0 1 0 1-10" /><path d="M12 8v5l3 2" /></>,
  import: <><path d="M12 15V3" /><path d="m7 8 5-5 5 5" /><path d="M4 14v6h16v-6" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  minus: <path d="M5 12h14" />,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  redo: <><path d="m16 5 4 4-4 4" /><path d="M20 9h-8a7 7 0 0 0-7 7v1" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  shield: <><path d="M12 3 5 6v5c0 4.7 2.8 8.1 7 10 4.2-1.9 7-5.3 7-10V6z" /><path d="m9 12 2 2 4-5" /></>,
  spark: <><path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" /><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z" /></>,
  trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14" /></>,
  undo: <><path d="m8 5-4 4 4 4" /><path d="M4 9h8a7 7 0 0 1 7 7v1" /></>,
  warning: <><path d="M12 3 2.8 20h18.4z" /><path d="M12 9v4M12 17h.01" /></>,
};

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg aria-hidden="true" className="sf-icon" fill="none" height={size} viewBox="0 0 24 24" width={size}>
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
        {paths[name]}
      </g>
    </svg>
  );
}
