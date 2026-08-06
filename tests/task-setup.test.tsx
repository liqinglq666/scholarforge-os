import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskSetup } from '@/components/task-setup/task-setup';
import { getPrimaryResearchExample } from '@/lib/examples';
import type { WorkspaceDraft } from '@/lib/types';
import { createDraft } from '@/lib/workspace/schema';

const unavailable = {
  configured: false,
  model: null,
  message: '分析服务未配置。',
  limits: { maxCharacters: 12_000, maxRequestBytes: 80_000, requestsPerWindow: 6, windowMinutes: 10 },
};

function exampleDraft(taskType: WorkspaceDraft['taskType']) {
  const example = getPrimaryResearchExample(taskType);
  if (!example) throw new Error(`Missing ${taskType} example`);
  return createDraft({
    projectName: example.projectName,
    taskType: example.taskType,
    sectionType: example.sectionType,
    targetJournal: example.targetJournal,
    sourceText: example.sourceText,
    terminologyLocks: example.terminologyLocks,
  });
}

function TaskSetupHarness({
  initialDraft,
  onAnalyze = vi.fn(),
}: {
  initialDraft: WorkspaceDraft;
  onAnalyze?: () => void;
}) {
  const [draft, setDraft] = useState(initialDraft);
  return (
    <TaskSetup
      analyzing={false}
      draft={draft}
      onAnalyze={onAnalyze}
      onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
      service={unavailable}
      serviceLoading={false}
    />
  );
}

describe('TaskSetup', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('explains and disables analysis when the service is not configured', () => {
    render(<TaskSetup analyzing={false} draft={createDraft({ sourceText: 'A'.repeat(60) })} onAnalyze={vi.fn()} onChange={vi.fn()} service={unavailable} serviceLoading={false} />);

    expect(screen.getByText('分析服务未配置', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '检查并开始分析' })).toBeDisabled();
    expect(screen.getByText('分析服务未配置。文本仍会保存在此浏览器。')).toBeInTheDocument();
  });

  it('keeps task selection and common metadata in the primary flow while terminology rules stay collapsed', async () => {
    render(<TaskSetupHarness initialDraft={createDraft()} />);

    await userEvent.click(screen.getByRole('radio', { name: /科研中译英/ }));
    expect(screen.getByRole('radio', { name: /科研中译英/ })).toBeChecked();
    expect(screen.getByText(/当前我的文本已保留/)).toBeInTheDocument();

    const terminologySummary = screen.getByText('术语规则');
    const terminologyDetails = terminologySummary.closest('details');
    expect(terminologyDetails).not.toHaveAttribute('open');
    await userEvent.click(terminologySummary);
    expect(terminologyDetails).toHaveAttribute('open');

    await userEvent.type(screen.getByLabelText('任务名称（可选）'), 'M');
    expect(screen.getByLabelText('任务名称（可选）')).toHaveValue('M');
  });

  it('loads a complete same-theme example without sending it for analysis', async () => {
    const onAnalyze = vi.fn();
    render(<TaskSetupHarness initialDraft={createDraft()} onAnalyze={onAnalyze} />);

    expect(screen.getByRole('heading', { name: '比较三种任务的处理边界' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /使用示例：英文保守润色/ }));

    expect(screen.getByRole('radio', { name: /英文保守润色/ })).toBeChecked();
    expect((screen.getByLabelText('英文论文原文') as HTMLTextAreaElement).value).toContain('42.5 MPa');
    expect(screen.getByLabelText('任务名称（可选）')).toHaveValue('水泥基材料孔结构研究 · 结果段保守润色');
    expect(screen.getByText('公开合成示例', { selector: '.source-origin-badge' })).toBeInTheDocument();
    expect(onAnalyze).not.toHaveBeenCalled();
  });

  it('switches the complete example package across all three tasks', async () => {
    render(<TaskSetupHarness initialDraft={exampleDraft('polish')} />);

    await userEvent.click(screen.getByRole('radio', { name: /科研中译英/ }));
    expect(screen.getByRole('radio', { name: /科研中译英/ })).toBeChecked();
    expect((screen.getByLabelText('中文科研原文') as HTMLTextAreaElement).value).toContain('养护28 d后');
    expect(screen.getByLabelText('任务名称（可选）')).toHaveValue('水泥基材料孔结构研究 · 结果段中译英');
    expect(screen.getByLabelText('目标期刊或语境（可选）')).toHaveValue('Construction and Building Materials');
    expect(screen.getByText(/正文、任务名称、期刊和术语规则已同步更新/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: /投稿前检查/ }));
    expect(screen.getByRole('radio', { name: /投稿前检查/ })).toBeChecked();
    expect((screen.getByLabelText('英文论文原文') as HTMLTextAreaElement).value).toContain('No independent durability test');
    expect(screen.getByLabelText('任务名称（可选）')).toHaveValue('水泥基材料孔结构研究 · 结果段投稿前检查');
  });

  it('preserves custom manuscript text when the selected task changes', async () => {
    const customText = 'This is a manually edited manuscript passage that must remain unchanged when the task changes.';
    render(<TaskSetupHarness initialDraft={createDraft({ taskType: 'polish', sourceText: customText })} />);

    await userEvent.click(screen.getByRole('radio', { name: /投稿前检查/ }));

    expect(screen.getByRole('radio', { name: /投稿前检查/ })).toBeChecked();
    expect(screen.getByLabelText('英文论文原文')).toHaveValue(customText);
    expect(screen.getByText(/当前我的文本已保留/)).toBeInTheDocument();
  });

  it('moves an edited example into custom mode and protects it from later task switches', async () => {
    render(<TaskSetupHarness initialDraft={exampleDraft('polish')} />);

    const editor = screen.getByLabelText('英文论文原文');
    await userEvent.type(editor, ' Author note.');
    const editedText = (editor as HTMLTextAreaElement).value;

    expect(screen.getByText('我的文本', { selector: '.source-origin-badge' })).toBeInTheDocument();
    expect(screen.getByText(/之后切换任务不会覆盖当前内容/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: /科研中译英/ }));
    expect(screen.getByLabelText('中文科研原文')).toHaveValue(editedText);
  });

  it('can undo an automatic example switch', async () => {
    const polishExample = getPrimaryResearchExample('polish');
    render(<TaskSetupHarness initialDraft={exampleDraft('polish')} />);

    await userEvent.click(screen.getByRole('radio', { name: /科研中译英/ }));
    await userEvent.click(screen.getByRole('button', { name: '撤销切换' }));

    expect(screen.getByRole('radio', { name: /英文保守润色/ })).toBeChecked();
    expect(screen.getByLabelText('英文论文原文')).toHaveValue(polishExample!.sourceText);
    expect(screen.getByText('已恢复切换前的正文和任务设置。')).toBeInTheDocument();
  });
});
