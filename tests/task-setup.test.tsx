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
    expect(screen.getByRole('button', { name: '开始分析' })).toBeDisabled();
  });

  it('keeps task selection in the primary flow and advanced metadata collapsed', async () => {
    const onChange = vi.fn();
    render(<TaskSetup analyzing={false} draft={createDraft()} onAnalyze={vi.fn()} onChange={onChange} service={unavailable} serviceLoading={false} />);
    await userEvent.click(screen.getByText('科研中译英', { selector: 'strong' }));
    expect(onChange).toHaveBeenCalledWith({ taskType: 'translate' });
    await userEvent.click(screen.getByText('高级设置与 DOCX 导入'));
    await userEvent.type(screen.getByLabelText('任务名称（可选）'), 'My paper');
    expect(onChange).toHaveBeenCalledWith({ projectName: 'M' });
  });

  it('loads a complete example without sending it for analysis', async () => {
    const onChange = vi.fn();
    const onAnalyze = vi.fn();
    render(<TaskSetup analyzing={false} draft={createDraft()} onAnalyze={onAnalyze} onChange={onChange} service={unavailable} serviceLoading={false} />);

    await userEvent.click(screen.getByText('第一次使用？载入示例'));
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
});
