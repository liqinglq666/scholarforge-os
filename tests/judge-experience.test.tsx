import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { JudgeExperience } from '@/components/judge/judge-experience';

describe('JudgeExperience', () => {
  it('quarantines a deterministic numerical mutation and shows evidence', () => {
    render(<JudgeExperience />);

    expect(screen.getByRole('heading', { name: '数字被 AI 偷偷改了' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '运行 Safety Gate' }));

    expect(screen.getByText('48.3 MPa ≠ 58.3 MPa')).toBeInTheDocument();
    expect(screen.getByText(/候选修改已进入 quarantined/)).toBeInTheDocument();
    expect(screen.getByText('Numerical invariant')).toBeInTheDocument();
  });

  it('keeps author confirmation after a case passes the gate', () => {
    render(<JudgeExperience />);

    fireEvent.click(screen.getByRole('button', { name: /安全的语言润色/ }));
    fireEvent.click(screen.getByRole('button', { name: '运行 Safety Gate' }));

    expect(screen.getByText(/通过当前硬规则，但仍然不能绕过作者确认/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '接受' }));

    expect(screen.getByText(/作者已选择：接受/)).toBeInTheDocument();
  });

  it('summarizes the public challenge set only after all three cases are checked', () => {
    render(<JudgeExperience />);

    fireEvent.click(screen.getByRole('button', { name: '运行 Safety Gate' }));
    fireEvent.click(screen.getByRole('button', { name: /相关性被升级成因果/ }));
    fireEvent.click(screen.getByRole('button', { name: '运行 Safety Gate' }));
    fireEvent.click(screen.getByRole('button', { name: /安全的语言润色/ }));
    fireEvent.click(screen.getByRole('button', { name: '运行 Safety Gate' }));

    expect(screen.getByRole('heading', { name: '三次修改，三次留下可核对的权限结论' })).toBeInTheDocument();
    expect(screen.getByText('危险修改被隔离')).toBeInTheDocument();
    expect(screen.getByText('自动写入论文')).toBeInTheDocument();
    expect(screen.getByText('Attack the Gate')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '重置并再次挑战 Safety Gate' }));
    expect(screen.queryByRole('heading', { name: '三次修改，三次留下可核对的权限结论' })).not.toBeInTheDocument();
    expect(screen.getByText('0 / 3')).toBeInTheDocument();
  });
});
