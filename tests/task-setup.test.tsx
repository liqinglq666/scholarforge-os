import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TaskSetup } from '@/components/task-setup/task-setup';
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
    expect(screen.getByRole('button', { name: '检查发送内容' })).toBeDisabled();
  });

  it('reports draft changes to the unified workspace owner', async () => {
    const onChange = vi.fn();
    render(<TaskSetup analyzing={false} draft={createDraft()} onAnalyze={vi.fn()} onChange={onChange} service={unavailable} serviceLoading={false} />);
    await userEvent.type(screen.getByLabelText('项目名称'), 'My paper');
    expect(onChange).toHaveBeenCalledWith({ projectName: 'M' });
    await userEvent.click(screen.getByText('科研中译英', { selector: 'b' }));
    expect(onChange).toHaveBeenCalledWith({ taskType: 'translate' });
  });

  it('loads a complete example without sending it for analysis', async () => {
    const onChange = vi.fn();
    const onAnalyze = vi.fn();
    render(<TaskSetup analyzing={false} draft={createDraft()} onAnalyze={onAnalyze} onChange={onChange} service={unavailable} serviceLoading={false} />);

    await userEvent.click(screen.getByRole('button', { name: /使用示例：材料与工程/ }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      taskType: 'polish',
      sectionType: 'results',
      projectName: expect.stringContaining('孔结构'),
      sourceText: expect.stringContaining('42.5 MPa'),
    }));
    expect(onAnalyze).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('示例已载入');
  });
});
