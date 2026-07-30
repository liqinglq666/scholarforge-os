import type {
  AgentId,
  AgentRun,
  IssueSeverity,
  ReviewGuardrail,
  ReviewIssue,
  ReviewMode,
  ReviewOutputKind,
  ReviewRequest,
  ReviewResult,
  ReviewSection,
  TerminologyItem,
  TerminologyLock,
  WorkspaceTask,
} from './types';

const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DEFAULT_MODEL = 'qwen-plus';
const WORKFLOW_VERSION = '0.8.0';
const AGENT_IDS: AgentId[] = ['terminology', 'language', 'logic', 'method'];

const SHARED_RULES = `
Hard rules:
1. Never invent experiments, sample counts, numerical results, standards, references, equipment settings, statistical significance, manuscript changes, or causal evidence.
2. Preserve every reported number, unit, material name, specimen label, and scientific claim unless the wording itself is being cautiously qualified.
3. When information is missing, write a visible author placeholder beginning with [Please provide ...].
4. Do not introduce citations, DOI values, references, page numbers, line numbers, or claims that are absent from the supplied material.
5. Respect every user-locked terminology rule.
6. Return JSON only. Do not use Markdown fences.
`;

const SECTION_GUIDANCE: Record<ReviewSection, string> = {
  general: 'Treat the input as a general manuscript excerpt and apply cross-disciplinary academic review criteria.',
  abstract: 'Prioritize concision, objective-method-result-conclusion balance, scope alignment, and avoidance of unsupported novelty or impact claims.',
  introduction: 'Prioritize research-gap clarity, literature-to-gap logic, objective alignment, and novelty boundaries.',
  methods: 'Prioritize reproducibility, materials, specimens, equipment, parameters, sample counts, controls, statistics, equations, and standards.',
  results: 'Prioritize objective reporting, statistical wording, figure/table consistency, and separation of observation from interpretation.',
  discussion: 'Prioritize mechanism claims, alternative explanations, limitations, generalizability, and evidence-bounded interpretation.',
  conclusion: 'Prioritize concise synthesis, alignment with evidence, limitation awareness, and removal of overgeneralized claims.',
};

const MODE_GUIDANCE: Record<ReviewMode, string> = {
  conservative: 'Use minimal intervention and preserve author voice and sentence structure whenever possible.',
  balanced: 'Balance readability improvement with scientific caution and identify meaningful risks without over-editing.',
  deep: 'Perform a thorough diagnostic review while obeying all no-invention and scientific-meaning guardrails.',
};

const TASK_GUIDANCE: Record<WorkspaceTask, string> = {
  translate: 'Translate Chinese scientific writing into publication-ready English. Preserve all facts and claim strength. The language specialist must return the complete English translation.',
  polish: 'Polish an English manuscript passage conservatively. The language specialist must return a complete revised passage.',
  precheck: 'Perform a reviewer-style pre-submission audit. The language specialist should still return a conservative revised passage, while the other specialists diagnose risks.',
  'review-response': 'Draft a professional response to a reviewer comment using only author-supplied evidence and stated manuscript changes. The language specialist must return a complete response containing acknowledgement, direct answer, manuscript change, and location. Use placeholders when evidence or location is missing.',
};

const OUTPUT_KIND: Record<WorkspaceTask, ReviewOutputKind> = {
  translate: 'translation',
  polish: 'revision',
  precheck: 'precheck',
  'review-response': 'reviewer-response',
};

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

interface AgentPayload {
  summary: string;
  revisedText: string;
  issues: ReviewIssue[];
  terminology: TerminologyItem[];
}

interface AgentExecution {
  payload: AgentPayload;
  run: AgentRun;
}

function basePrompt(agent: AgentId, taskType: WorkspaceTask) {
  const taskSpecific: Record<AgentId, string> = {
    terminology: taskType === 'translate'
      ? 'Audit Chinese-to-English terminology mapping, abbreviations, units, nomenclature, and user-locked terms. Do not translate the whole passage.'
      : taskType === 'review-response'
        ? 'Audit terminology consistency between the reviewer comment, author evidence, manuscript change, and response draft. Do not write the whole response.'
        : 'Audit terminology, abbreviations, units, nomenclature, spelling variants, and user-locked terms. Do not rewrite the whole passage.',
    language: taskType === 'translate'
      ? 'Produce the complete publication-ready English translation. Improve academic syntax and cohesion without changing scientific meaning.'
      : taskType === 'review-response'
        ? 'Produce the complete reviewer-response draft. Be respectful, direct, evidence-bounded, and explicit about the manuscript change and location.'
        : 'Produce the complete conservatively revised English passage. Improve grammar, syntax, academic tone, concision, cohesion, tense, voice, and collocation.',
    logic: taskType === 'review-response'
      ? 'Check whether the draft directly answers the reviewer, whether every statement is supported by the supplied author evidence, and whether any claim exceeds that evidence. Do not write the whole response.'
      : 'Audit argument structure, causal overstatement, unsupported generalization, ambiguity, consistency between claims, and whether wording exceeds the evidence.',
    method: taskType === 'review-response'
      ? 'Check whether the response requires additional experiments, sample information, parameters, statistics, manuscript changes, or precise locations. Never claim that work was completed unless the author supplied that evidence.'
      : 'Audit reproducibility and reporting completeness: materials, specimens, dimensions, sample counts, curing, devices, parameters, repetitions, data reduction, uncertainty, statistics, standards, equations, symbols, and figure/table references.',
  };

  const revisedInstruction = agent === 'language'
    ? 'the complete primary output for the selected task'
    : '';

  return `You are the ${agent} specialist in ScholarForge OS / PaperLens.\n${taskSpecific[agent]}\nTask: ${TASK_GUIDANCE[taskType]}\n${SHARED_RULES}\nReturn this exact JSON shape:\n{\n  "summary": "string",\n  "revisedText": "${revisedInstruction}",\n  "issues": [{\n    "severity": "major | minor | suggestion",\n    "location": "string",\n    "original": "string",\n    "revised": "string",\n    "reason": "string",\n    "category": "string",\n    "meaningChanged": false\n  }],\n  "terminology": [{\n    "preferred": "string",\n    "avoid": ["string"],\n    "note": "string"\n  }]\n}`;
}

function stripJsonFence(value: string) {
  return value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeSeverity(value: unknown): IssueSeverity {
  return value === 'major' || value === 'suggestion' ? value : 'minor';
}

function normalizeAgentPayload(raw: unknown, agent: AgentId): AgentPayload {
  if (!raw || typeof raw !== 'object') throw new Error(`${agent} returned an invalid object.`);
  const data = raw as Record<string, unknown>;
  const rawIssues = Array.isArray(data.issues) ? data.issues : [];
  const rawTerms = Array.isArray(data.terminology) ? data.terminology : [];

  return {
    summary: asString(data.summary, `${agent} completed its audit.`),
    revisedText: asString(data.revisedText),
    issues: rawIssues.slice(0, 16).map((item, index) => {
      const issue = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      return {
        id: `${agent}-${index + 1}`,
        agent,
        severity: normalizeSeverity(issue.severity),
        location: asString(issue.location, 'Location not specified'),
        original: asString(issue.original),
        revised: asString(issue.revised),
        reason: asString(issue.reason, 'Specialist review recommended an author check.'),
        category: asString(issue.category, 'Academic writing'),
        meaningChanged: issue.meaningChanged === true,
      };
    }),
    terminology: rawTerms.slice(0, 12).map((item) => {
      const term = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      return {
        preferred: asString(term.preferred),
        avoid: Array.isArray(term.avoid)
          ? term.avoid.filter((value): value is string => typeof value === 'string').slice(0, 8)
          : [],
        note: asString(term.note),
      };
    }).filter((item) => item.preferred),
  };
}

function lockText(lockedTerms: TerminologyLock[]) {
  if (!lockedTerms.length) return 'No user-locked terminology rules.';
  return lockedTerms.map((lock, index) => `${index + 1}. Source/trigger: ${lock.source}; required output: ${lock.preferred}${lock.note ? `; note: ${lock.note}` : ''}`).join('\n');
}

async function runSpecialist(
  agent: AgentId,
  request: Required<Pick<ReviewRequest, 'text' | 'taskType' | 'sectionType' | 'reviewMode'>> & ReviewRequest,
  apiKey: string,
  baseUrl: string,
  model: string,
): Promise<AgentExecution> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 46_000);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: agent === 'language' ? 0.15 : 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: basePrompt(agent, request.taskType) },
          {
            role: 'user',
            content: [
              `Task type: ${request.taskType}`,
              `Target journal: ${request.targetJournal || 'Not specified'}`,
              `Manuscript section: ${request.sectionType}`,
              `Review mode: ${request.reviewMode}`,
              `Section guidance: ${SECTION_GUIDANCE[request.sectionType]}`,
              `Mode guidance: ${MODE_GUIDANCE[request.reviewMode]}`,
              `Response/manuscript location: ${request.responseLocation || 'Not supplied'}`,
              '',
              'User-locked terminology:',
              lockText(request.lockedTerms || []),
              '',
              'Primary input:',
              request.text,
              '',
              'Author-supplied context or planned manuscript change:',
              request.supportingContext || 'Not supplied',
            ].join('\n'),
          },
        ],
      }),
      signal: controller.signal,
      cache: 'no-store',
    });

    const body = await response.json() as ChatCompletionResponse;
    if (!response.ok) throw new Error(body.error?.message || `${agent} failed with status ${response.status}.`);
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error(`${agent} returned an empty response.`);
    const payload = normalizeAgentPayload(JSON.parse(stripJsonFence(content)) as unknown, agent);

    return {
      payload,
      run: {
        agent,
        status: 'completed',
        durationMs: Date.now() - startedAt,
        issueCount: payload.issues.length,
        summary: payload.summary,
        model,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      payload: { summary: '', revisedText: '', issues: [], terminology: [] },
      run: {
        agent,
        status: 'failed',
        durationMs: Date.now() - startedAt,
        issueCount: 0,
        summary: `${agent} did not complete.`,
        model,
        error: message,
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

function uniqueIssues(items: ReviewIssue[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.agent}|${item.location}|${item.category}|${item.original}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 40);
}

function uniqueTerms(items: TerminologyItem[], locks: TerminologyLock[]) {
  const merged = [
    ...locks.map((lock) => ({ preferred: lock.preferred, avoid: lock.source && lock.source !== lock.preferred ? [lock.source] : [], note: lock.note || 'User-locked terminology rule.' })),
    ...items,
  ];
  const seen = new Set<string>();
  return merged.filter((item) => {
    const key = item.preferred.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 20);
}

function scorePenalty(issue: ReviewIssue) {
  if (issue.severity === 'suggestion') return 1;
  if (issue.severity === 'minor') return issue.agent === 'method' || issue.agent === 'logic' ? 4 : 3;
  return issue.agent === 'method' || issue.agent === 'logic' ? 10 : 7;
}

function remainingPenalty(issue: ReviewIssue) {
  if (issue.severity === 'suggestion') return 0;
  if (issue.agent === 'method') return issue.severity === 'major' ? 9 : 3;
  if (issue.agent === 'logic') return issue.severity === 'major' ? 7 : 2;
  return issue.severity === 'major' ? 2 : 0;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function decide(scoreAfter: number, issues: ReviewIssue[], taskType: WorkspaceTask): Pick<ReviewResult, 'decision' | 'decisionReason'> {
  const majorIssues = issues.filter((issue) => issue.severity === 'major');
  const unresolvedMajor = majorIssues.filter((issue) => issue.agent === 'method' || issue.agent === 'logic');
  const subject = taskType === 'review-response' ? 'reviewer response' : taskType === 'translate' ? 'translation' : 'manuscript passage';

  if (scoreAfter < 80 || unresolvedMajor.length >= 2) {
    return { decision: 'major_revision', decisionReason: `${unresolvedMajor.length} major logic or evidence issues remain author-dependent; the ${subject} is not ready for final use.` };
  }
  if (scoreAfter < 92 || majorIssues.length > 0) {
    return { decision: 'minor_revision', decisionReason: `The ${subject} is usable as a working draft, but at least one substantive or author-dependent item still requires confirmation.` };
  }
  return { decision: 'ready', decisionReason: `No major evidence, logic, terminology-lock, or reproducibility issue remains in the reviewed ${subject}.` };
}

function numericTokens(value: string) {
  return new Set(value.match(/\b\d+(?:\.\d+)?\b/g) || []);
}

function hasNewNumericToken(source: string, revised: string) {
  const sourceTokens = numericTokens(source);
  return [...numericTokens(revised)].some((token) => !sourceTokens.has(token));
}

function locksPreserved(source: string, revised: string, locks: TerminologyLock[]) {
  const sourceLower = source.toLowerCase();
  const revisedLower = revised.toLowerCase();
  return locks.every((lock) => {
    const trigger = lock.source.trim().toLowerCase();
    const preferred = lock.preferred.trim().toLowerCase();
    return !trigger || !preferred || !sourceLower.includes(trigger) || revisedLower.includes(preferred);
  });
}

function buildGuardrails(source: string, revised: string, issues: ReviewIssue[], locks: TerminologyLock[]): ReviewGuardrail[] {
  const methodMajors = issues.filter((issue) => issue.agent === 'method' && issue.severity === 'major');
  return [
    { id: 'numbers', label: 'No numerical value outside the source or author-supplied context was introduced.', passed: !hasNewNumericToken(source, revised) },
    { id: 'meaning', label: 'No specialist explicitly marked a scientific meaning change.', passed: !issues.some((issue) => issue.meaningChanged) },
    { id: 'missing-info', label: 'Missing scientific or response evidence remains visible as an author action.', passed: methodMajors.length === 0 || methodMajors.every((issue) => issue.revised.startsWith('[Please provide')) },
    { id: 'terminology-locks', label: 'User-locked terminology was preserved in the primary output.', passed: locksPreserved(source, revised, locks) },
  ];
}

export async function reviewWithBailian(text: string, options: Partial<ReviewRequest> = {}): Promise<ReviewResult> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error('DASHSCOPE_API_KEY is not configured.');

  const baseUrl = (process.env.DASHSCOPE_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
  const model = process.env.DASHSCOPE_MODEL || DEFAULT_MODEL;
  const taskType = options.taskType || 'precheck';
  const sectionType = options.sectionType || 'general';
  const reviewMode = options.reviewMode || 'balanced';
  const lockedTerms = options.lockedTerms || [];
  const normalizedRequest = {
    ...options,
    text,
    taskType,
    sectionType,
    reviewMode,
    lockedTerms,
  };

  const executions = await Promise.all(
    AGENT_IDS.map((agent) => runSpecialist(agent, normalizedRequest, apiKey, baseUrl, model)),
  );
  const completed = executions.filter((execution) => execution.run.status === 'completed');
  if (completed.length === 0) throw new Error('All specialist agents failed. Check the Model Studio model, quota, and endpoint.');

  const issues = uniqueIssues(completed.flatMap((execution) => execution.payload.issues));
  const terminology = uniqueTerms(completed.flatMap((execution) => execution.payload.terminology), lockedTerms);
  const languageExecution = executions.find((execution) => execution.run.agent === 'language');
  const candidateOutput = languageExecution?.payload.revisedText || text;
  const allowedSource = `${text}\n${options.supportingContext || ''}`;
  const revisedText = hasNewNumericToken(allowedSource, candidateOutput) ? text : candidateOutput;
  const scoreBefore = clampScore(100 - issues.reduce((total, issue) => total + scorePenalty(issue), 0));
  const scoreAfter = clampScore(Math.max(scoreBefore, 100 - issues.reduce((total, issue) => total + remainingPenalty(issue), 0)));
  const decision = decide(scoreAfter, issues, taskType);
  const failedCount = executions.length - completed.length;

  return {
    mode: 'live',
    executionMode: 'parallel-multi-agent',
    workflowVersion: WORKFLOW_VERSION,
    outputKind: OUTPUT_KIND[taskType],
    profile: {
      projectTitle: options.projectTitle?.trim() || 'Untitled research writing task',
      taskType,
      targetJournal: options.targetJournal?.trim() || '',
      sectionType,
      reviewMode,
      responseLocation: options.responseLocation?.trim() || '',
      supportingContextProvided: Boolean(options.supportingContext?.trim()),
      lockedTerms,
    },
    summary: `${completed.length} independent Model Studio specialists completed the ${taskType} workflow${failedCount ? `; ${failedCount} agent failed and was excluded from aggregation` : ''}. The final score and decision were calculated deterministically from the normalized issue set.`,
    revisedText,
    scoreBefore,
    scoreAfter,
    ...decision,
    issues,
    terminology,
    agentRuns: executions.map((execution) => execution.run),
    guardrails: buildGuardrails(allowedSource, revisedText, issues, lockedTerms),
    generatedAt: new Date().toISOString(),
  };
}
