import type { AgentId, IssueSeverity, ReviewResult } from './types';

const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DEFAULT_MODEL = 'qwen-plus';

const SYSTEM_PROMPT = `You are the orchestration layer of ScholarForge OS, a multi-agent academic English review system.
Simulate four specialist agents: terminology, language, logic, and method.

Review the supplied manuscript passage under these hard rules:
1. Never invent experiments, sample counts, numerical results, standards, references, or equipment settings.
2. When required information is missing, use a visible author placeholder beginning with [Please provide ...].
3. Preserve scientific meaning and all reported data.
4. Distinguish language problems from scientific logic and reproducibility problems.
5. Avoid overstating causality, significance, novelty, or certainty.
6. Return JSON only, with no Markdown fences or commentary.

The JSON must have this exact shape:
{
  "summary": "string",
  "revisedText": "string",
  "scoreBefore": 0,
  "scoreAfter": 0,
  "decision": "major_revision | minor_revision | ready",
  "issues": [
    {
      "id": "string",
      "agent": "terminology | language | logic | method",
      "severity": "major | minor | suggestion",
      "location": "string",
      "original": "string",
      "revised": "string",
      "reason": "string",
      "category": "string",
      "meaningChanged": false
    }
  ],
  "terminology": [
    {
      "preferred": "string",
      "avoid": ["string"],
      "note": "string"
    }
  ]
}`;

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

function stripJsonFence(value: string): string {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

function asNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeAgent(value: unknown): AgentId {
  return value === 'terminology' || value === 'logic' || value === 'method'
    ? value
    : 'language';
}

function normalizeSeverity(value: unknown): IssueSeverity {
  return value === 'major' || value === 'suggestion' ? value : 'minor';
}

function normalizeResult(raw: unknown): Omit<ReviewResult, 'mode' | 'generatedAt'> {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Model returned an invalid review object.');
  }

  const data = raw as Record<string, unknown>;
  const rawIssues = Array.isArray(data.issues) ? data.issues : [];
  const rawTerms = Array.isArray(data.terminology) ? data.terminology : [];
  const decision = data.decision === 'major_revision' || data.decision === 'ready'
    ? data.decision
    : 'minor_revision';

  return {
    summary: asString(data.summary, 'The manuscript review was completed.'),
    revisedText: asString(data.revisedText),
    scoreBefore: asNumber(data.scoreBefore, 70),
    scoreAfter: asNumber(data.scoreAfter, 85),
    decision,
    issues: rawIssues.slice(0, 24).map((item, index) => {
      const issue = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      return {
        id: asString(issue.id, `issue-${index + 1}`),
        agent: normalizeAgent(issue.agent),
        severity: normalizeSeverity(issue.severity),
        location: asString(issue.location, 'Location not specified'),
        original: asString(issue.original),
        revised: asString(issue.revised),
        reason: asString(issue.reason, 'Revision recommended for academic clarity.'),
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

export async function reviewWithBailian(text: string, targetJournal?: string): Promise<ReviewResult> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error('DASHSCOPE_API_KEY is not configured.');
  }

  const baseUrl = (process.env.DASHSCOPE_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
  const model = process.env.DASHSCOPE_MODEL || DEFAULT_MODEL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 52_000);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Target journal: ${targetJournal || 'Not specified'}\n\nManuscript passage:\n${text}`,
          },
        ],
      }),
      signal: controller.signal,
      cache: 'no-store',
    });

    const payload = await response.json() as ChatCompletionResponse;
    if (!response.ok) {
      throw new Error(payload.error?.message || `Model Studio request failed with status ${response.status}.`);
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Model Studio returned an empty response.');
    }

    const parsed = JSON.parse(stripJsonFence(content)) as unknown;
    return {
      ...normalizeResult(parsed),
      mode: 'live',
      generatedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timeout);
  }
}
