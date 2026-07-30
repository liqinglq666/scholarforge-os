import type {
  AgentId,
  AgentRun,
  IssueSeverity,
  ReviewGuardrail,
  ReviewIssue,
  ReviewMode,
  ReviewResult,
  ReviewSection,
  TerminologyItem,
} from './types';

const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DEFAULT_MODEL = 'qwen-plus';
const WORKFLOW_VERSION = '0.7.0';
const AGENT_IDS: AgentId[] = ['terminology', 'language', 'logic', 'method'];

const SHARED_RULES = `
Hard rules:
1. Never invent experiments, sample counts, numerical results, standards, references, equipment settings, statistical significance, or causal evidence.
2. Preserve every reported number, unit, material name, specimen label, and scientific claim unless the wording itself is being cautiously qualified.
3. When information is missing, write a visible author placeholder beginning with [Please provide ...].
4. Do not introduce citations, DOI values, references, or claims that are absent from the source.
5. Return JSON only. Do not use Markdown fences.
`;

const AGENT_PROMPTS: Record<AgentId, string> = {
  terminology: `You are Terminology Guardian, one specialist in ScholarForge OS.
Audit only terminology, abbreviations, units, nomenclature, spelling variants, and consistency. Do not rewrite the whole passage.
${SHARED_RULES}
Return this exact JSON shape:
{
  "summary": "string",
  "revisedText": "",
  "issues": [{
    "severity": "major | minor | suggestion",
    "location": "string",
    "original": "string",
    "revised": "string",
    "reason": "string",
    "category": "string",
    "meaningChanged": false
  }],
  "terminology": [{
    "preferred": "string",
    "avoid": ["string"],
    "note": "string"
  }]
}`,
  language: `You are Academic Editor, one specialist in ScholarForge OS.
Improve grammar, syntax, academic tone, concision, cohesion, articles, tense, voice, and collocation. Produce a conservative full revised passage. Do not add scientific interpretation or missing experimental details.
${SHARED_RULES}
Return this exact JSON shape:
{
  "summary": "string",
  "revisedText": "the complete conservatively revised passage",
  "issues": [{
    "severity": "major | minor | suggestion",
    "location": "string",
    "original": "string",
    "revised": "string",
    "reason": "string",
    "category": "string",
    "meaningChanged": false
  }],
  "terminology": []
}`,
  logic: `You are Logic Auditor, one specialist in ScholarForge OS.
Audit argument structure, causal overstatement, unsupported generalization, ambiguity, consistency between claims, and whether wording exceeds the evidence presented. Do not rewrite the whole passage.
${SHARED_RULES}
Return this exact JSON shape:
{
  "summary": "string",
  "revisedText": "",
  "issues": [{
    "severity": "major | minor | suggestion",
    "location": "string",
    "original": "string",
    "revised": "a cautious evidence-bounded alternative",
    "reason": "string",
    "category": "string",
    "meaningChanged": false
  }],
  "terminology": []
}`,
  method: `You are Method Auditor, one specialist in ScholarForge OS.
Audit reproducibility and reporting completeness: materials, specimens, dimensions, sample counts, curing, devices, test parameters, repetitions, data reduction, uncertainty, statistics, standards, equations, symbols, and figure/table references. Do not invent missing details and do not rewrite the whole passage.
${SHARED_RULES}
Return this exact JSON shape:
{
  "summary": "string",
  "revisedText": "",
  "issues": [{
    "severity": "major | minor | suggestion",
    "location": "string",
    "original": "string",
    "revised": "[Please provide ...]",
    "reason": "string",
    "category": "string",
    "meaningChanged": false
  }],
  "terminology": []
}`,
};

const SECTION_GUIDANCE: Record<ReviewSection, string> = {
  general: 'Treat the passage as a general manuscript excerpt. Apply normal cross-disciplinary academic review criteria.',
  abstract: 'Prioritize concision, objective-method-result-conclusion balance, quantified claims already present, scope alignment, and avoidance of unsupported novelty or impact claims.',
  introduction: 'Prioritize research-gap clarity, literature-to-gap logic, objective alignment, novelty boundaries, and a coherent progression from context to research question.',
  methods: 'Prioritize reproducibility, materials and specimen definitions, equipment and parameter reporting, sample counts, controls, statistics, equations, and standards.',
  results: 'Prioritize objective reporting, distinction between observation and interpretation, consistency with figures/tables, statistical wording, and avoidance of causal claims not established by the design.',
  discussion: 'Prioritize mechanism claims, comparison with prior work, alternative explanations, limitations, generalizability, and evidence-bounded interpretation.',
  conclusion: 'Prioritize concise synthesis, alignment with presented evidence, practical implications, limitation awareness, and removal of overgeneralized or promotional claims.',
};

const MODE_GUIDANCE: Record<ReviewMode, string> = {
  conservative: 'Use minimal intervention. Flag only clear risks and make the smallest defensible wording changes. Preserve author voice and sentence structure whenever possible.',
  balanced: 'Balance readability improvement with scientific caution. Identify meaningful language, terminology, logic, and reporting issues without over-editing.',
  deep: 'Perform a thorough diagnostic review. Surface subtle consistency, logic, reproducibility, and reporting risks, while still obeying all no-invention and scientific-meaning guardrails.',
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

function stripJsonFence(value: string): string {
  return value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

function asString(value: unknown, fallback = ''): string {
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
        reason: asString(issue.reason, 'Specialist review recommended a revision.'),
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

async function runSpecialist(
  agent: AgentId,
  text: string,
  targetJournal: string | undefined,
  sectionType: ReviewSection,
  reviewMode: ReviewMode,
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
          { role: 'system', content: AGENT_PROMPTS[agent] },
          {
            role: 'user',
            content: [
              `Target journal: ${targetJournal || 'Not specified'}`,
              `Manuscript section: ${sectionType}`,
              `Review mode: ${reviewMode}`,
              `Section-specific guidance: ${SECTION_GUIDANCE[sectionType]}`,
              `Review-mode guidance: ${MODE_GUIDANCE[reviewMode]}`,
              '',
              'Manuscript passage:',
              text,
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

function uniqueIssues(items: ReviewIssue[]): ReviewIssue[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.agent}|${item.location}|${item.category}|${item.original}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 40);
}

function uniqueTerms(items: TerminologyItem[]): TerminologyItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.preferred.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 16);
}

function scorePenalty(issue: ReviewIssue): number {
  if (issue.severity === 'suggestion') return 1;
  if (issue.severity === 'minor') return issue.agent === 'method' || issue.agent === 'logic' ? 4 : 3;
  return issue.agent === 'method' || issue.agent === 'logic' ? 10 : 7;
}

function remainingPenalty(issue: ReviewIssue): number {
  if (issue.severity === 'suggestion') return 0;
  if (issue.agent === 'method') return issue.severity === 'major' ? 9 : 3;
  if (issue.agent === 'logic') return issue.severity === 'major' ? 7 : 2;
  return issue.severity === 'major' ? 2 : 0;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function decide(scoreAfter: number, issues: ReviewIssue[]): Pick<ReviewResult, 'decision' | 'decisionReason'> {
  const majorIssues = issues.filter((issue) => issue.severity === 'major');
  const unresolvedMajor = majorIssues.filter((issue) => issue.agent === 'method' || issue.agent === 'logic');

  if (scoreAfter < 80 || unresolvedMajor.length >= 2) {
    return {
      decision: 'major_revision',
      decisionReason: `${unresolvedMajor.length} major logic or reproducibility issues remain author-dependent; the manuscript is not yet submission-ready.`,
    };
  }
  if (scoreAfter < 92 || majorIssues.length > 0) {
    return {
      decision: 'minor_revision',
      decisionReason: 'The language revision improves readability, but at least one substantive or author-dependent issue still requires confirmation.',
    };
  }
  return {
    decision: 'ready',
    decisionReason: 'No major evidence, logic, or reproducibility issue remains in the reviewed passage.',
  };
}

function numericTokens(value: string): Set<string> {
  return new Set(value.match(/\b\d+(?:\.\d+)?\b/g) || []);
}

function hasNewNumericToken(source: string, revised: string): boolean {
  const sourceTokens = numericTokens(source);
  return [...numericTokens(revised)].some((token) => !sourceTokens.has(token));
}

function buildGuardrails(source: string, revised: string, issues: ReviewIssue[]): ReviewGuardrail[] {
  const methodMajors = issues.filter((issue) => issue.agent === 'method' && issue.severity === 'major');
  return [
    { id: 'numbers', label: 'No new numerical value was introduced by the revision.', passed: !hasNewNumericToken(source, revised) },
    { id: 'meaning', label: 'No specialist explicitly marked a scientific meaning change.', passed: !issues.some((issue) => issue.meaningChanged) },
    {
      id: 'missing-info',
      label: 'Missing reproducibility details remain visible as author actions.',
      passed: methodMajors.length === 0 || methodMajors.every((issue) => issue.revised.startsWith('[Please provide')),
    },
  ];
}

export async function reviewWithBailian(
  text: string,
  options: {
    projectTitle?: string;
    targetJournal?: string;
    sectionType?: ReviewSection;
    reviewMode?: ReviewMode;
  } = {},
): Promise<ReviewResult> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error('DASHSCOPE_API_KEY is not configured.');

  const baseUrl = (process.env.DASHSCOPE_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
  const model = process.env.DASHSCOPE_MODEL || DEFAULT_MODEL;
  const sectionType = options.sectionType || 'general';
  const reviewMode = options.reviewMode || 'balanced';

  const executions = await Promise.all(
    AGENT_IDS.map((agent) => runSpecialist(
      agent,
      text,
      options.targetJournal,
      sectionType,
      reviewMode,
      apiKey,
      baseUrl,
      model,
    )),
  );

  const completed = executions.filter((execution) => execution.run.status === 'completed');
  if (completed.length === 0) throw new Error('All specialist agents failed. Check the Model Studio model, quota, and endpoint.');

  const issues = uniqueIssues(completed.flatMap((execution) => execution.payload.issues));
  const terminology = uniqueTerms(completed.flatMap((execution) => execution.payload.terminology));
  const languageExecution = executions.find((execution) => execution.run.agent === 'language');
  const candidateRevision = languageExecution?.payload.revisedText || text;
  const revisedText = hasNewNumericToken(text, candidateRevision) ? text : candidateRevision;

  const scoreBefore = clampScore(100 - issues.reduce((total, issue) => total + scorePenalty(issue), 0));
  const scoreAfter = clampScore(Math.max(scoreBefore, 100 - issues.reduce((total, issue) => total + remainingPenalty(issue), 0)));
  const decision = decide(scoreAfter, issues);
  const failedCount = executions.length - completed.length;

  return {
    mode: 'live',
    executionMode: 'parallel-multi-agent',
    workflowVersion: WORKFLOW_VERSION,
    profile: {
      projectTitle: options.projectTitle?.trim() || 'Untitled manuscript review',
      targetJournal: options.targetJournal?.trim() || '',
      sectionType,
      reviewMode,
    },
    summary: `${completed.length} independent specialist agents completed the ${sectionType} review in ${reviewMode} mode${failedCount ? `; ${failedCount} agent failed and was excluded from aggregation` : ''}. The final score and reviewer decision were calculated deterministically from the normalized issue set rather than accepted from a model response.`,
    revisedText,
    scoreBefore,
    scoreAfter,
    ...decision,
    issues,
    terminology,
    agentRuns: executions.map((execution) => execution.run),
    guardrails: buildGuardrails(text, revisedText, issues),
    generatedAt: new Date().toISOString(),
  };
}
