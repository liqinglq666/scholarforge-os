'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tools = [
  { href: '/project', label: '论文项目', description: '章节与一致性' },
  { href: '/feedback', label: '导师意见', description: '处理与说明' },
  { href: '/versions', label: '版本比较', description: '差异与报告' },
];

export function ProjectToolNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="论文项目工具" className="project-tool-nav">
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
