import type {
  AgentRun,
  ReviewRequest,
  ReviewResult,
  TerminologyLock,
  WorkspaceTask,
} from './types';

export const SAMPLE_MANUSCRIPT = `Low-field nuclear magnetic resonance (LF-NMR) tests were conducted using an NMR spectrometer to measure the T2 spectra of seawater-cured specimens. The test temperature was controlled at 22–28 °C, and the number of scans was 32. The results can well prove that the pore structure became much denser after curing. This phenomenon resulted in the increase of compressive strength. However, the number of specimens and the method used to calculate the average value were not reported.`;

export const SAMPLE_CHINESE_MANUSCRIPT = `采用低场核磁共振（LF-NMR）测试海水养护试件的 T2 谱。试验温度控制在 22–28 °C，扫描次数为 32 次。结果表明，养护后孔隙结构得到细化，并与抗压强度的提高相关。但文中尚未说明每组试件数量以及代表值的计算方法。`;

export const SAMPLE_REVIEW_COMMENT = `Reviewer 2, Comment 3: The manuscript states that pore refinement caused the increase in compressive strength. Please clarify whether the experimental design supports a causal conclusion and provide the number of specimens tested in each group.`;

export const SAMPLE_RESPONSE_CONTEXT = `Author evidence: Three specimens were tested for each mixture. The study only establishes an association between the LF-NMR response and compressive strength, not a causal mechanism. Planned manuscript change: replace “resulted in” with “was associated with” and add the specimen count to the Methods section.`;

const DEMO_RUNS: AgentRun[] = [
  { agent: 'terminology', status: 'demo', durationMs: 612, issueCount: 1, summary: 'Terminology, abbreviations, and user-locked expressions were checked.', model: 'demo-fixture' },
  { agent: 'language', status: 'demo', durationMs: 884, issueCount: 1, summary: 'The primary output was generated conservatively for the selected task.', model: 'demo-fixture' },
  { agent: 'logic', status: 'demo', durationMs: 771, issueCount: 1, summary: 'Claim scope and evidence boundaries were reviewed.', model: 'demo-fixture' },
  { agent: 'method', status: 'demo', durationMs: 806, issueCount: 1, summary: 'Missing reproducibility or response evidence was retained as author actions.', model: 'demo-fixture' },
];

function outputForTask(taskType: WorkspaceTask, source: string, supportingContext: string) {
  if (taskType === 'translate') {
    return source === SAMPLE_CHINESE_MANUSCRIPT
      ? 'Low-field nuclear magnetic resonance (LF-NMR) was used to measure the T2 spectra of seawater-cured specimens. The test temperature was controlled at 22–28 °C, and 32 scans were performed. The results indicated that the pore structure was refined after curing and that this refinement was associated with an increase in compressive strength. However, the number of specimens tested per group and the method used to calculate the representative value were not reported.'
      : source;
  }

  if (taskType === 'review-response') {
    return supportingContext
      ? `Response: Thank you for this important comment. We agree that the original wording overstated causality. The sentence has been revised to state that pore refinement “was associated with” the increase in compressive strength. We have also clarified that three specimens were tested for each mixture.\n\nChanges in the manuscript: The causal wording was revised, and the specimen count was added to the Methods section.\n\nLocation: [Please confirm the final page and line numbers after typesetting.]`
      : `Response: Thank you for this comment. We agree that the statement requires clarification. [Please provide the author evidence, the exact manuscript change, and the final location before submitting this response.]`;
  }

  return source
    .replace('The results can well prove that', 'The results indicate that')
    .replace('became much denser', 'was refined')
    .replace(
      'This phenomenon resulted in the increase of compressive strength.',
      'This microstructural refinement was associated with an increase in compressive strength.',
    );
}

function lockGuardrail(locks: TerminologyLock[], source: string, output: string) {
  const sourceLower = source.toLowerCase();
  const outputLower = output.toLowerCase();
  return locks.every((lock) => {
    const trigger = lock.source.trim().toLowerCase();
    const preferred = lock.preferred.trim().toLowerCase();
    return !trigger || !preferred || !sourceLower.includes(trigger) || outputLower.includes(preferred);
  });
}

export function createDemoReview(text: string, options: Partial<ReviewRequest> = {}): ReviewResult {
  const source = text.trim() || SAMPLE_MANUSCRIPT;
  const taskType = options.taskType || 'precheck';
  const supportingContext = options.supportingContext?.trim() || '';
  const lockedTerms = options.lockedTerms || [];
  const revisedText = outputForTask(taskType, source, supportingContext);
  const outputKind = taskType === 'translate'
    ? 'translation'
    : taskType === 'review-response'
      ? 'reviewer-response'
      : taskType === 'polish'
        ? 'revision'
        : 'precheck';

  return {
    mode: 'demo',
    executionMode: 'safe-demo',
    workflowVersion: '0.8.0-demo',
    outputKind,
    profile: {
      projectTitle: options.projectTitle?.trim() || 'Demo research writing task',
      taskType,
      targetJournal: options.targetJournal?.trim() || '',
      sectionType: options.sectionType || 'general',
      reviewMode: options.reviewMode || 'balanced',
      responseLocation: options.responseLocation?.trim() || '',
      supportingContextProvided: Boolean(supportingContext),
      lockedTerms,
    },
    summary: 'Four deterministic demo specialists completed the selected PaperLens workflow. The result demonstrates task routing, scientific guardrails, terminology locks, issue evidence, and author decisions without calling an external model.',
    revisedText,
    scoreBefore: 72,
    scoreAfter: taskType === 'review-response' && !supportingContext ? 74 : 82,
    decision: taskType === 'review-response' && !supportingContext ? 'major_revision' : 'minor_revision',
    decisionReason: taskType === 'review-response' && !supportingContext
      ? 'The reviewer-response draft still lacks author-supplied evidence and a confirmed manuscript location.'
      : 'The primary output is usable as a working draft, but substantive author-dependent items still require confirmation.',
    generatedAt: new Date().toISOString(),
    terminology: [
      {
        preferred: 'low-field nuclear magnetic resonance (LF-NMR)',
        avoid: ['low field NMR', 'low-frequency NMR'],
        note: 'Define the abbreviation once and use the same hyphenation throughout the manuscript.',
      },
      ...lockedTerms.map((lock) => ({
        preferred: lock.preferred,
        avoid: lock.source && lock.source !== lock.preferred ? [lock.source] : [],
        note: lock.note || 'User-locked terminology rule.',
      })),
    ],
    issues: [
      {
        id: 'demo-language-1',
        agent: 'language',
        severity: 'minor',
        location: taskType === 'review-response' ? 'Response draft' : 'Sentence 3',
        original: taskType === 'review-response' ? source : 'The results can well prove that the pore structure became much denser after curing.',
        revised: taskType === 'review-response' ? revisedText : 'The results indicate that the pore structure was refined after curing.',
        reason: taskType === 'translate'
          ? 'The English output should use concise academic syntax while preserving every reported fact.'
          : taskType === 'review-response'
            ? 'The response should acknowledge the comment, answer it directly, and identify the manuscript change.'
            : 'The original wording is unnatural and overly absolute in academic English.',
        category: taskType === 'translate' ? 'Translation quality' : taskType === 'review-response' ? 'Response completeness' : 'Academic expression',
        meaningChanged: false,
      },
      {
        id: 'demo-logic-1',
        agent: 'logic',
        severity: 'major',
        location: taskType === 'review-response' ? 'Reviewer comment and response' : 'Sentence 4',
        original: 'This phenomenon resulted in the increase of compressive strength.',
        revised: 'This microstructural refinement was associated with an increase in compressive strength.',
        reason: 'The causal wording exceeds the evidence described in the passage and should be bounded more cautiously.',
        category: 'Causal overstatement',
        meaningChanged: false,
      },
      {
        id: 'demo-method-1',
        agent: 'method',
        severity: 'major',
        location: taskType === 'review-response' ? 'Evidence supplied by the author' : 'Methods information',
        original: taskType === 'review-response' ? supportingContext || 'No author evidence supplied.' : 'The number of specimens and the representative-value method were not reported.',
        revised: supportingContext ? 'Use only the supplied evidence and confirm the final manuscript location.' : '[Please provide the number of specimens, supporting evidence, and final manuscript location.]',
        reason: 'The missing information must be supplied by the author rather than invented by the system.',
        category: taskType === 'review-response' ? 'Response evidence' : 'Reproducibility',
        meaningChanged: false,
      },
      {
        id: 'demo-terminology-1',
        agent: 'terminology',
        severity: 'suggestion',
        location: 'Terminology profile',
        original: 'Low-field nuclear magnetic resonance (LF-NMR)',
        revised: 'low-field nuclear magnetic resonance (LF-NMR)',
        reason: 'Keep the abbreviation, capitalization, and hyphenation consistent.',
        category: 'Terminology consistency',
        meaningChanged: false,
      },
    ],
    agentRuns: DEMO_RUNS,
    guardrails: [
      { id: 'numbers', label: 'No numerical value outside the source or author-supplied context was introduced.', passed: true },
      { id: 'meaning', label: 'No specialist explicitly marked a scientific meaning change.', passed: true },
      { id: 'missing-info', label: 'Missing scientific or response evidence remains visible as an author action.', passed: supportingContext.length > 0 || taskType !== 'review-response' },
      { id: 'terminology-locks', label: 'User-locked terminology was preserved in the primary output.', passed: lockGuardrail(lockedTerms, `${source}\n${supportingContext}`, revisedText) },
    ],
  };
}
