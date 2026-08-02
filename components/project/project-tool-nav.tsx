'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function ProjectToolNav({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const tools = [
    { href: `/projects/${projectId}`, label: '章节与概览', description: '项目正文与一致性' },
    { href: `/projects/${projectId}/review`, label: '当前审校', description: '章节处理与作者确认' },
    { href: `/projects/${projectId}/feedback`, label: '意见与回复', description: '导师、合作者与审稿意见' },
    { href: `/projects/${projectId}/versions`, label: '版本记录', description: '差异与修改说明' },
  ];
  return (
    <nav aria-label="当前项目工具" className="project-tool-nav">
      <Link className="project-back-link" href="/projects">← 所有项目</Link>
      {tools.map((tool) => {
        const active = pathname === tool.href;
        return (
          <Link aria-current={active ? 'page' : undefined} className={active ? 'active' : ''} href={tool.href} key={tool.href}>
            <strong>{tool.label}</strong><span>{tool.description}</span>
          </Link>
        );
      })}
    </nav>
  );
}
