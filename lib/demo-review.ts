import type { AgentRun, ReviewResult } from './types';

export const SAMPLE_MANUSCRIPT = `Low-field nuclear magnetic resonance (LF-NMR) tests were conducted using an NMR spectrometer to measure the T2 spectra of seawater-cured specimens. The test temperature was controlled at 22–28 °C, and the number of scans was 32. The results can well prove that the pore structure became much denser after curing. This phenomenon resulted in the increase of compressive strength. However, the number of specimens and the method used to calculate the average value were not reported.`;

const DEMO_RUNS: AgentRun[] = [
  {
    agent: 'terminology',
    status: 'demo',
    durationMs: 612,
    issueCount: 1,
    summary: 'Terminology and abbreviation usage were checked for consistency.',
    model: 'demo-fixture',
  },
  {
    agent: 'language',
    status: 'demo',
    durationMs: 884,
    issueCount: 1,
    summary: 'Academic expression and sentence-level clarity were improved conservatively.',
    model: 'demo-fixture',
  },
  {
    agent: 'logic',
    status: 'demo',
    durationMs: 771,
    issueCount: 1,
    summary: 'One causal statement exceeded the evidence shown in the passage.',
    model: 'demo-fixture',
  },
  {
    agent: 'method',
    status: 'demo',
    durationMs: 806,
    issueCount: 1,
    summary: 'Missing specimen count and data-reduction details were retained as author actions.',
    model: 'demo-fixture',
  },
];

export function createDemoReview(text: string): ReviewResult {
  const source = text.trim() || SAMPLE_MANUSCRIPT;
  const revisedText = source
    .replace('The results can well prove that', 'The results indicate that')
    .replace('became much denser', 'was refined')
    .replace(
      'This phenomenon resulted in the increase of compressive strength.',
      'This microstructural refinement was associated with an increase in compressive strength.',
    );

  return {
    mode: 'demo',
    executionMode: 'safe-demo',
    workflowVersion: '0.2.0-demo',
    summary:
      'Four deterministic demo specialists completed the review. The passage contains one language issue, one causal overstatement, one reproducibility issue, and one terminology recommendation.',
    revisedText,
    scoreBefore: 72,
    scoreAfter: 78,
    decision: 'major_revision',
    decisionReason:
      'Two author-dependent logic or reproducibility issues remain unresolved, so a high language score alone cannot make the passage submission-ready.',
    generatedAt: new Date().toISOString(),
    terminology: [
      {
        preferred: 'low-field nuclear magnetic resonance (LF-NMR)',
        avoid: ['low field NMR', 'low-frequency NMR'],
        note: 'Define the abbreviation once and use LF-NMR consistently thereafter.',
      },
      {
        preferred: 'pore structure refinement',
        avoid: ['pore structure became much denser'],
        note: 'The preferred term is more precise and avoids conversational wording.',
      },
    ],
    issues: [
      {
        id: 'demo-language-1',
        agent: 'language',
        severity: 'minor',
        location: 'Sentence 3',
        original: 'The results can well prove that the pore structure became much denser after curing.',
        revised: 'The results indicate that the pore structure was refined after curing.',
        reason: '“Can well prove” and “much denser” are unnatural and overly absolute in academic English.',
        category: 'Academic expression',
        meaningChanged: false,
      },
      {
        id: 'demo-logic-1',
        agent: 'logic',
        severity: 'major',
        location: 'Sentence 4',
        original: 'This phenomenon resulted in the increase of compressive strength.',
        revised: 'This microstructural refinement was associated with an increase in compressive strength.',
        reason: 'The original sentence presents causation without showing that the experimental design established a causal relationship.',
        category: 'Causal overstatement',
        meaningChanged: false,
      },
      {
        id: 'demo-method-1',
        agent: 'method',
        severity: 'major',
        location: 'Final sentence',
        original: 'However, the number of specimens and the method used to calculate the average value were not reported.',
        revised: '[Please provide the number of specimens tested per group and the method used to calculate the representative value.]',
        reason: 'The missing information affects reproducibility and must be supplied by the author rather than invented by the system.',
        category: 'Reproducibility',
        meaningChanged: false,
      },
      {
        id: 'demo-terminology-1',
        agent: 'terminology',
        severity: 'suggestion',
        location: 'Sentence 1',
        original: 'Low-field nuclear magnetic resonance (LF-NMR)',
        revised: 'Low-field nuclear magnetic resonance (LF-NMR)',
        reason: 'The term is correctly defined. Keep the abbreviation and hyphenation consistent throughout the manuscript.',
        category: 'Terminology consistency',
        meaningChanged: false,
      },
    ],
    agentRuns: DEMO_RUNS,
    guardrails: [
      { id: 'numbers', label: 'No new numerical value was introduced by the revision.', passed: true },
      { id: 'meaning', label: 'No specialist explicitly marked a scientific meaning change.', passed: true },
      { id: 'missing-info', label: 'Missing reproducibility details remain visible as author actions.', passed: true },
    ],
  };
}
