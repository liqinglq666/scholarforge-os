import type { ReviewResult } from './types';

export const SAMPLE_MANUSCRIPT = `Low-field nuclear magnetic resonance (LF-NMR) tests were conducted using an NMR spectrometer to measure the T2 spectra of seawater-cured specimens. The test temperature was controlled at 22–28 °C, and the number of scans was 32. The results can well prove that the pore structure became much denser after curing. This phenomenon resulted in the increase of compressive strength. However, the number of specimens and the method used to calculate the average value were not reported.`;

export function createDemoReview(text: string): ReviewResult {
  const source = text.trim() || SAMPLE_MANUSCRIPT;
  const revisedText = source
    .replace('The results can well prove that', 'The results clearly indicate that')
    .replace('became much denser', 'was refined')
    .replace('This phenomenon resulted in the increase of compressive strength.', 'This microstructural refinement was associated with an increase in compressive strength.');

  return {
    mode: 'demo',
    summary:
      'The passage is generally understandable, but it contains an unnatural academic expression, an overstrong causal claim, and missing reproducibility information. The revision improves precision without inventing experimental details.',
    revisedText,
    scoreBefore: 72,
    scoreAfter: 89,
    decision: 'minor_revision',
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
        revised: 'The results clearly indicate that the pore structure was refined after curing.',
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
        revised: '[Please report the number of specimens tested per group and the method used to calculate the representative value.]',
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
  };
}
