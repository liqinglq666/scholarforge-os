import type {
  ReviewIssue,
  ReviewRequest,
  ReviewResult,
  WorkspaceTask,
} from './types';

export const SAMPLE_MANUSCRIPT = `Low-field nuclear magnetic resonance (LF-NMR) tests were conducted using an NMR spectrometer to measure the T2 spectra of seawater-cured specimens. The test temperature was controlled at 22–28 °C, and the number of scans was 32. The results can well prove that the pore structure became much denser after curing. This phenomenon resulted in the increase of compressive strength. However, the number of specimens and the method used to calculate the average value were not reported.`;

export const SAMPLE_CHINESE_MANUSCRIPT = `采用低场核磁共振（LF-NMR）测试海水养护试件的 T2 谱。试验温度控制在 22–28 °C，扫描次数为 32 次。结果表明，养护后孔隙结构得到细化，并与抗压强度的提高相关。但文中尚未说明每组试件数量以及代表值的计算方法。`;

function outputForTask(taskType: WorkspaceTask, source: string) {
  if (taskType === 'translate') {
    return source === SAMPLE_CHINESE_MANUSCRIPT
      ? 'Low-field nuclear magnetic resonance (LF-NMR) was used to measure the T2 spectra of seawater-cured specimens. The test temperature was controlled at 22–28 °C, and 32 scans were performed. The results indicated that the pore structure was refined after curing and that this refinement was associated with an increase in compressive strength. However, the number of specimens tested per group and the method used to calculate the representative value were not reported.'
      : source;
  }

  return source
    .replace('The results can well prove that', 'The results indicate that')
    .replace('became much denser', 'was refined')
    .replace(
      'This phenomenon resulted in the increase of compressive strength.',
      'This microstructural refinement was associated with an increase in compressive strength.',
    );
}

function demoIssues(taskType: WorkspaceTask, source: string): ReviewIssue[] {
  const issues: ReviewIssue[] = [];

  if (taskType !== 'translate' && source.includes('The results can well prove that')) {
    issues.push({
      id: 'demo-language-1',
      agent: 'language',
      severity: 'minor',
      location: 'Current paragraph',
      original: 'The results can well prove that',
      revised: 'The results indicate that',
      reason: 'The original wording is non-idiomatic and expresses stronger certainty than the evidence supports.',
      category: 'Academic wording',
      meaningChanged: false,
    });
  }

  if (source.toLowerCase().includes('resulted in the increase')) {
    issues.push({
      id: 'demo-logic-1',
      agent: 'logic',
      severity: 'major',
      location: 'Current paragraph',
      original: 'This phenomenon resulted in the increase of compressive strength.',
      revised: 'This microstructural refinement was associated with an increase in compressive strength.',
      reason: 'The source does not establish a causal relationship. The suggestion preserves an association-level claim.',
      category: 'Causal claim',
      meaningChanged: true,
    });
  }

  if (/number of specimens|试件数量/i.test(source)) {
    issues.push({
      id: 'demo-method-1',
      agent: 'method',
      severity: 'major',
      location: 'Current paragraph',
      original: '',
      revised: '[Please provide the number of specimens tested per group and the method used to calculate the representative value.]',
      reason: 'The missing sample count and aggregation method prevent reproducibility and must be supplied by the author.',
      category: 'Method reporting',
      meaningChanged: false,
    });
  }

  return issues;
}

export function createDemoReview(text: string, options: Partial<ReviewRequest> = {}): ReviewResult {
  const source = text.trim() || SAMPLE_MANUSCRIPT;
  const taskType = options.taskType || 'precheck';
  const revisedText = outputForTask(taskType, source);
  const outputKind = taskType === 'translate' ? 'translation' : taskType === 'polish' ? 'revision' : 'precheck';

  return {
    mode: 'demo',
    executionMode: 'safe-demo',
    workflowVersion: '0.9.0-demo',
    outputKind,
    profile: {
      projectTitle: options.projectTitle?.trim() || 'Demo research writing task',
      taskType,
      targetJournal: options.targetJournal?.trim() || '',
      sectionType: options.sectionType || 'general',
      lockedTerms: options.lockedTerms || [],
    },
    summary: 'The demonstration workflow produced a conservative draft and a short evidence list without calling an external model.',
    revisedText,
    issues: demoIssues(taskType, source),
    generatedAt: new Date().toISOString(),
  };
}
