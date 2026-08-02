import { describe, expect, it } from 'vitest';
import { splitSupervisorFeedback } from '@/lib/project/feedback';

describe('splitSupervisorFeedback', () => {
  it('splits numbered and bulleted feedback while keeping continuation lines', () => {
    const result = splitSupervisorFeedback(`1. 摘要需要明确样本量。\n请同时说明研究对象。\n2、讨论部分不要重复结果。\n- 核对表2中的数值。`);
    expect(result).toEqual([
      '摘要需要明确样本量。 请同时说明研究对象。',
      '讨论部分不要重复结果。',
      '核对表2中的数值。',
    ]);
  });

  it('uses blank paragraphs when no explicit numbering exists', () => {
    const result = splitSupervisorFeedback('导师意见：补充伦理审批信息。\n\n说明模型超参数选择依据。');
    expect(result).toEqual(['补充伦理审批信息。', '说明模型超参数选择依据。']);
  });
});
