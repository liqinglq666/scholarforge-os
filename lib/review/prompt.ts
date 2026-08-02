import { SECTION_LABELS, TASK_LABELS } from '@/lib/config';
import type { ReviewRequest } from '@/lib/types';

const SYSTEM_RULES = `You are a conservative scientific writing reviewer. The author remains responsible for every decision.

Hard rules:
- Never invent facts, values, units, sample sizes, experiments, methods, results, citations, DOIs, journal rules, or locations.
- Preserve every number, scientific-notation value, percentage, unit, variable, specimen label, and claim-strength boundary exactly.
- Never change correlation into causation or imply certainty not supported by the source.
- If scientific information is missing, report an author action; do not insert a placeholder into suggestedText.
- Every issue must cite an exact source excerpt when possible.
- safeToApply may be true only for a local, single-paragraph wording change that does not change scientific meaning and needs no author information.
- meaningChanged must be true whenever a suggestion could alter facts, interpretation, certainty, method, result, terminology, or scope.
- Return JSON only. Do not wrap it in Markdown.`;

export function buildReviewPrompt(request: ReviewRequest) {
  const taskGuidance = request.taskType === 'translate'
    ? 'Translate the complete Chinese source into careful academic English.'
    : request.taskType === 'polish'
      ? 'Conservatively polish the complete English source for grammar, syntax, cohesion, concision, and academic tone.'
      : 'Run a pre-submission check. Keep suggestedText conservative and complete; identify language, terminology, logic, reporting, and evidence-boundary issues.';

  const locks = request.terminologyLocks.length
    ? request.terminologyLocks.map((item) => `- ${JSON.stringify(item.source)} must be rendered as ${JSON.stringify(item.preferred)}${item.note ? ` (${item.note})` : ''}`).join('\n')
    : '- None';

  return {
    system: SYSTEM_RULES,
    user: `${taskGuidance}

Task: ${TASK_LABELS[request.taskType]}
Section: ${SECTION_LABELS[request.sectionType]}
Target journal (context only; do not claim verification): ${request.targetJournal || 'Not specified'}
Terminology locks:
${locks}

Return exactly this shape:
{
  "summary": "brief author-facing summary",
  "suggestedText": "complete suggested text",
  "issues": [{
    "id": "unique stable id",
    "category": "Language | Terminology | Logic | Methods | Evidence boundary | Author information",
    "severity": "major | minor | suggestion",
    "location": "author-readable location",
    "original": "exact source excerpt",
    "revised": "local revision, or empty when author action is required",
    "reason": "specific explanation",
    "meaningChanged": false,
    "authorActionRequired": false,
    "safeToApply": false,
    "safetyReason": "why safe application is unavailable, otherwise empty"
  }]
}

SOURCE:
${request.text}`,
  };
}
