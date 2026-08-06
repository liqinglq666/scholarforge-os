import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TaskSetup } from '@/components/task-setup/task-setup';
import { getPrimaryResearchExample, RESEARCH_EXAMPLES } from '@/lib/examples';
import { createDraft } from '@/lib/workspace/schema';

const unavailable = {
  configured: false,
  model: null,
  message: '分析服务未配置。',
  limits: { maxCharacters: 12_000, maxRequestBytes: 80_000, requestsPerWindow: 6, windowMinutes: 10 },
};

describe('TaskSetup', () => {
  it('explains and disables analysis when the service is not configured', () => {
    render(<TaskSetup analyzing={false} draft={createDraft({ sourceText: 'A'.repeat(60) })} onAnalyze={vi.fn()} onChange={vi.fn()} service={unavailable} serviceLoading={false} />);

    expect(screen.getByText('分析服务未配置', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '检查并开始分析' })).toBeDisabled();
    expect(screen.getByText('分析服务未配置。文本仍会保存在此浏览器。')).toBeInTheDocument();
  });

  it('keeps task selection and common metadata in the primary flow while terminology rules stay collapsed', async () => {
    const onChange = vi.fn();
    render(<TaskSetup analyzing={false} draft={createDraft()} onAnalyze={vi.fn()} onChange={onChange} service={unavailable} serviceLoading={false} />);

    await userEvent.click(screen.getByText('科研中译英', { selector: 'strong' }));
    expect(onChange).toHaveBeenCalledWith({ taskType: 'translate' });

    const terminologySummary = screen.getByText('术语规则');
    const terminologyDetails = terminologySummary.closest('details');
    expect(terminologyDetails).not.toHaveAttribute('open');
    await userEvent.click(terminologySummary);
    expect(terminologyDetails).toHaveAttribute('open');

    await userEvent.type(screen.getByLabelText('任务名称（可选）'), 'M');
    expect(onChange).toHaveBeenCalledWith({ projectName: 'M' });
  });

  it('loads a complete example without sending it for analysis', async () => {
    const onChange = vi.fn();
    const onAnalyze = vi.fn();
    render(<TaskSetup analyzing={false} draft={createDraft()} onAnalyze={onAnalyze} onChange={onChange} service={unavailable} serviceLoading={false} />);

    expect(screen.getByRole('heading', { name: '载入一个公开合成案例' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /使用示例：材料与工程/ }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      taskType: 'polish',
      sectionType: 'results',
      projectName: expect.stringContaining('孔结构'),
      sourceText: expect.stringContaining('42.5 MPa'),
    }));
    expect(onAnalyze).not.toHaveBeenCalled();
    expect(screen.getByText(/示例已载入/)).toBeInTheDocument();
  });

  it('switches the complete sample when the selected task changes', async () => {
    const currentExample = RESEARCH_EXAMPLES.find((example) => example.id === 'materials-polish');
    const translationExample = getPrimaryResearchExample('translate');
    expect(currentExample).toBeDefined();
    expect(translationExample).not.toBeNull();

    const onChange = vi.fn();
    render(
      <TaskSetup
        analyzing={false}
        draft={createDraft({
          projectName: currentExample!.projectName,
          taskType: currentExample!.taskType,
          sectionType: currentExample!.sectionType,
          targetJournal: currentExample!.targetJournal,
          sourceText: currentExample!.sourceText,
          terminologyLocks: currentExample!.terminologyLocks,
        })}
        onAnalyze={vi.fn()}
        onChange={onChange}
        service={unavailable}
        serviceLoading={false}
      />,
    );

    await userEvent.click(screen.getByRole('radio', { name: /科研中译英/ }));

    expect(onChange).toHaveBeenCalledWith({
      projectName: translationExample!.projectName,
      taskType: 'translate',
      sectionType: translationExample!.sectionType,
      targetJournal: translationExample!.targetJournal,
      sourceText: translationExample!.sourceText,
      terminologyLocks: translationExample!.terminologyLocks.map((term) => ({ ...term })),
      importedDocument: undefined,
    });
  });

  it('preserves custom manuscript text when the selected task changes', async () => {
    const onChange = vi.fn();
    const customText = 'This is a manually edited manuscript passage that must remain unchanged when the task changes.';
    render(
      <TaskSetup
        analyzing={false}
        draft={createDraft({ taskType: 'polish', sourceText: customText })}
        onAnalyze={vi.fn()}
        onChange={onChange}
        service={unavailable}
        serviceLoading={false}
      />,
    );

    await userEvent.click(screen.getByRole('radio', { name: /投稿前检查/ }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ taskType: 'precheck' });
  });
});
