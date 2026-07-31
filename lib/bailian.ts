import type {
  AgentId,
  IssueSeverity,
  ReviewIssue,
  ReviewOutputKind,
  ReviewRequest,
  ReviewResult,
  ReviewSection,
  TerminologyLock,
  WorkspaceTask,
} from './types';

const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DEFAULT_MODEL = 'qwen-plus';
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

const TASK_GUIDANCE: Record<WorkspaceTask, string> = {
  translate: 'Translate Chinese scientific writing into publication-ready English. Preserve all facts and claim strength. The language specialist must return the complete English translation.',
  polish: 'Polish an English manuscript passage conservatively. The language specialist must return a complete revised passage.',
  precheck: 'Perform a reviewer-style pre-submission audit. The language specialist should still return a conservative revised passage, while the other specialists diagnose risks.',
};

const OUTPUT_KIND: Record<WorkspaceTask, ReviewOutputKind> = {
  translate: 'translation',
  polish: 'revision',
  precheck: 'precheck',
};

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

interface AgentPayload {
  summary: string;
  revisedText: string;
  issues: ReviewIssue[];
}

interface AgentExecution {
  agent: AgentId;
  status: 'completed' | 'failed';
  payload: AgentPayload;
}

function basePrompt(agent: AgentId, taskType: WorkspaceTask) {
  const taskSpecific: Record<AgentId, string> = {
    terminology: taskType === 'translate'
      ? 'Audit Chinese-to-English terminology mapping, abbreviations, units, nomenclature, and user-locked terms. Do not translate the whole passage.'
      : 'Audit terminology, abbreviations, units, nomenclature, spelling variants, and user-locked terms. Do not rewrite the whole passage.',
    language: taskType === 'translate'
      ? 'Produce the complete publication-ready English translation. Improve academic syntax and cohesion without changing scientific meaning.'
      : 'Produce the complete conservatively revised English passage. Improve grammar, syntax, academic tone, concision, cohesion, tense, voice, and collocation.',
    logic: 'Audit argument structure, causal overstatement, unsupported generalization, ambiguity, consistency between claims, and whether wording exceeds the evidence.',
    method: 'Audit reproducibility and reporting completeness: materials, specimens, dimensions, sample counts, curing, devices, parameters, repetitions, data reduction, uncertainty, statistics, standards, equations, symbols, and figure/table references.',
  };

  const revisedInstruction = agent === 'language'
    ? 'the complete primary output for the selected task'
    : '';

  return `You are the ${agent} specialist in ScholarForge OS.\n${taskSpecific[agent]}\nTask: ${TASK_GUIDANCE[taskType]}\n${SHARED_RULES}\nReturn this exact JSON shape:\n{\n  "summary": "string",\n  "revisedText": "${revisedInstruction}",\n  "issues": [{\n    "severity": "major | minor | suggestion",\n    "location": "string",\n    "original": "string",\n    "revised": "string",\n    "reason": "string",\n    "category": "string",\n    "meaningChanged": false\n  }]\n}`;
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
  };
}

function lockText(lockedTerms: TerminologyLock[]) {
  if (!lockedTerms.length) return 'No user-locked terminology rules.';
  return lockedTerms
    .map((lock, index) => `${index + 1}. Source/trigger: ${lock.source}; required output: ${lock.preferred}${lock.note ? `; note: ${lock.note}` : ''}`)
    .join('\n');
}

async function runSpecialist(
  agent: AgentId,
  request: Required<Pick<ReviewRequest, 'text' | 'taskType' | 'sectionType'>> & ReviewRequest,
  apiKey: string,
  baseUrl: string,
  model: string,
): Promise<AgentExecution> {
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
              `Section guidance: ${SECTION_GUIDANCE[request.sectionType]}`,
              'User-locked terminology:',
              lockText(request.lockedTerms || []),
              '',
              'Primary input:',
              request.text,
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

    return {
      agent,
      status: 'completed',
      payload: normalizeAgentPayload(JSON.parse(stripJsonFence(content)) as unknown, agent),
    };
  } catch {
    return {
      agent,
      status: 'failed',
      payload: { summary: '', revisedText: '', issues: [] },
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

function numericSignature(value: string) {
  return (value.match(/[-+]?\d+(?:,\d{3})*(?:\.\d+)?/g) || [])
    .map((token) => token.replace(/,/g, ''))
    .sort((a, b) => a.localeCompare(b))
    .join('|');
}

function summaryForTask(taskType: WorkspaceTask, issueCount: number, complete: boolean, numericMismatch: boolean) {
  const primary = taskType === 'translate'
    ? `已生成科研英语译文，并识别 ${issueCount} 条需要作者核对的事项。`
    : taskType === 'polish'
      ? `已生成保守润色稿，并识别 ${issueCount} 条需要作者核对的事项。`
      : `已完成投稿前检查，共识别 ${issueCount} 条需要作者处理的事项。`;
  const incomplete = complete ? '' : ' 部分检查未完成，本次结果可能不完整，建议稍后重新分析。';
  const guarded = numericMismatch ? ' 完整建议稿因数值变化被安全拦截，当前保留原文。' : '';
  return `${primary}${incomplete}${guarded}`;
}

export async function reviewWithBailian(text: string, options: Partial<ReviewRequest> = {}): Promise<ReviewResult> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error('DASHSCOPE_API_KEY is not configured.');

  const baseUrl = (process.env.DASHSCOPE_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
  const model = process.env.DASHSCOPE_MODEL || DEFAULT_MODEL;
  const taskType = options.taskType || 'precheck';
  const sectionType = options.sectionType || 'general';
  const lockedTerms = options.lockedTerms || [];
  const normalizedRequest = {
    ...options,
    text,
    taskType,
    sectionType,
    lockedTerms,
  };

  const executions = await Promise.all(
    AGENT_IDS.map((agent) => runSpecialist(agent, normalizedRequest, apiKey, baseUrl, model)),
  );
  const completed = executions.filter((execution) => execution.status === 'completed');
  const languageExecution = completed.find((execution) => execution.agent === 'language');

  if ((taskType === 'translate' || taskType === 'polish') && !languageExecution?.payload.revisedText) {
    throw new Error('The primary language output did not complete.');
  }
  if (taskType === 'precheck' && completed.length < 2) {
    throw new Error('Too few specialist checks completed to return a reliable result.');
  }

  const candidateOutput = languageExecution?.payload.revisedText || text;
  const numericMismatch = numericSignature(candidateOutput) !== numericSignature(text);
  const revisedText = numericMismatch ? text : candidateOutput;
  const safetyIssue: ReviewIssue[] = numericMismatch ? [{
    id: 'system-numeric-safety',
    agent: 'terminology',
    severity: 'major',
    location: 'Generated manuscript',
    original: '',
    revised: '',
    reason: 'The generated full-text output changed one or more numeric values. ScholarForge withheld the generated manuscript and kept the source text unchanged.',
    category: 'Numeric consistency',
    meaningChanged: true,
  }] : [];
  const issues = uniqueIssues([
    ...completed.flatMap((execution) => execution.payload.issues),
    ...safetyIssue,
  ]);

  return {
    outputKind: OUTPUT_KIND[taskType],
    profile: {
      projectTitle: options.projectTitle?.trim() || 'Untitled research writing task',
      taskType,
      targetJournal: options.targetJournal?.trim() || '',
      sectionType,
      lockedTerms,
    },
    summary: summaryForTask(taskType, issues.length, completed.length === AGENT_IDS.length, numericMismatch),
    revisedText,
    issues,
    generatedAt: new Date().toISOString(),
  };
}
