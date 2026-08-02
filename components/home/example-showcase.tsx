'use client';

import Link from 'next/link';
import { useState } from 'react';
import { SECTION_LABELS, TASK_LABELS } from '@/lib/config';
import { RESEARCH_EXAMPLES } from '@/lib/examples';

export function ExampleShowcase() {
  const [selectedId, setSelectedId] = useState(RESEARCH_EXAMPLES[0].id);
  const selected = RESEARCH_EXAMPLES.find((example) => example.id === selectedId) || RESEARCH_EXAMPLES[0];

  return (
    <div className="example-showcase" aria-label="跨学科示例">
      <div className="example-tabs" role="tablist" aria-label="选择研究示例">
        {RESEARCH_EXAMPLES.map((example) => (
          <button
            aria-controls="selected-example"
            aria-selected={selected.id === example.id}
            id={`example-tab-${example.id}`}
            key={example.id}
            onClick={() => setSelectedId(example.id)}
            role="tab"
            type="button"
          >
            <span>{example.discipline}</span>
            <small>{TASK_LABELS[example.taskType]}</small>
          </button>
        ))}
      </div>

      <article
        aria-labelledby={`example-tab-${selected.id}`}
        className="example-paper"
        id="selected-example"
        role="tabpanel"
      >
        <div className="paper-header">
          <span>{TASK_LABELS[selected.taskType]}</span>
          <span>{SECTION_LABELS[selected.sectionType]}</span>
        </div>
        <div className="example-heading">
          <span>{selected.discipline}</span>
          <h2>{selected.title}</h2>
        </div>
        <p className="paper-label">示例原文</p>
        <blockquote>{selected.sourceText}</blockquote>
        <div className="paper-issue">
          <span>典型检查点</span>
          <strong>{selected.focus}</strong>
          <p>示意建议：{selected.suggestion}</p>
        </div>
        <div className="example-footer">
          <small>示例仅用于体验流程，不代表真实分析结论。</small>
          <Link href={`/workspace?example=${selected.id}`}>在工作台使用此示例</Link>
        </div>
      </article>
    </div>
  );
}
