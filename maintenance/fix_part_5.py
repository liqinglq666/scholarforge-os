from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one match, found {count}')
    target.write_text(text.replace(old, new, 1), encoding='utf-8')


def append_before_last(path: str, marker: str, addition: str) -> None:
    target = Path(path)
    text = target.read_text(encoding='utf-8')
    index = text.rfind(marker)
    if index < 0:
        raise RuntimeError(f'{path}: marker not found')
    target.write_text(text[:index] + addition + text[index:], encoding='utf-8')


# Browser storage can be disabled at the property-access level.
replace_once(
    'components/workspace-hub.tsx',
    """  const refresh = useCallback(() => {
    setState(readWorkspaceState(window.localStorage));
  }, []);
""",
    """  const refresh = useCallback(() => {
    try {
      setState(readWorkspaceState(window.localStorage));
    } catch {
      setState((current) => ({
        ...current,
        warnings: Array.from(new Set([
          ...current.warnings,
          '浏览器阻止了本地数据读取，当前页面仍可临时使用。',
        ])),
      }));
    }
  }, []);
""",
)

# Reject valid JSON values that are not request objects.
replace_once(
    'app/api/review/route.ts',
    """export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let body: Partial<ReviewRequest>;

  try {
    body = await request.json() as Partial<ReviewRequest>;
  } catch {
    return noStoreJson({ error: '请求内容必须是有效的 JSON。', requestId }, 400);
  }

  try {
""",
    """export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let parsed: unknown;

  try {
    parsed = await request.json() as unknown;
  } catch {
    return noStoreJson({ error: '请求内容必须是有效的 JSON。', requestId }, 400);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return noStoreJson({ error: '请求内容必须是 JSON 对象。', requestId }, 400);
  }
  const body = parsed as Partial<ReviewRequest>;

  try {
""",
)

# Detect provider truncation instead of accepting partial manuscripts.
replace_once(
    'lib/bailian.ts',
    """interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}
""",
    """interface ChatCompletionResponse {
  choices?: Array<{
    message?: { content?: string };
    finish_reason?: string | null;
  }>;
  error?: { message?: string };
}
""",
)
replace_once(
    'lib/bailian.ts',
    """    if (!response.ok) throw new Error(body.error?.message || `${agent} failed with status ${response.status}.`);
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error(`${agent} returned an empty response.`);

    return {
""",
    """    if (!response.ok) throw new Error(body.error?.message || `${agent} failed with status ${response.status}.`);
    const choice = body.choices?.[0];
    const content = choice?.message?.content;
    if (!content) throw new Error(`${agent} returned an empty response.`);
    if (choice?.finish_reason === 'length') {
      throw new Error(`${agent} output was truncated before completion.`);
    }

    return {
""",
)

# Further harden restored browser state.
replace_once(
    'lib/workspace-store.ts',
    """function boundedString(value: unknown, fallback = '', max = 12_000) {
  return typeof value === 'string' ? value.slice(0, max) : fallback;
}

function normalizeLocks(value: unknown): TerminologyLock[] {
""",
    """function boundedString(value: unknown, fallback = '', max = 12_000) {
  return typeof value === 'string' ? value.slice(0, max) : fallback;
}

function nonEmptyString(value: unknown, fallback: string, max: number) {
  return boundedString(value, '', max).trim() || fallback;
}

function validTimestamp(value: unknown, fallback: string) {
  const candidate = boundedString(value, '', 80);
  return candidate && !Number.isNaN(Date.parse(candidate)) ? candidate : fallback;
}

function uniqueSnapshots(values: ReviewSnapshot[]) {
  const seen = new Set<string>();
  return values.filter((snapshot) => {
    if (seen.has(snapshot.id)) return false;
    seen.add(snapshot.id);
    return true;
  });
}

function normalizeLocks(value: unknown): TerminologyLock[] {
""",
)
replace_once(
    'lib/workspace-store.ts',
    """  return {
    projectTitle: boundedString(value.projectTitle, '', 120),
    taskType,
    sourceText: boundedString(value.sourceText, '', 12_000),
    targetJournal: boundedString(value.targetJournal, '', 160),
    sectionType,
    lockedTerms: normalizeLocks(value.lockedTerms),
    savedAt: boundedString(value.savedAt, new Date().toISOString(), 80),
    importedDocument,
  };
}
""",
    """  const now = new Date().toISOString();
  return {
    projectTitle: nonEmptyString(value.projectTitle, '未命名科研写作任务', 120),
    taskType,
    sourceText: boundedString(value.sourceText, '', 12_000),
    targetJournal: boundedString(value.targetJournal, '', 160),
    sectionType,
    lockedTerms: normalizeLocks(value.lockedTerms),
    savedAt: validTimestamp(value.savedAt, now),
    importedDocument,
  };
}
""",
)
replace_once(
    'lib/workspace-store.ts',
    """  const lockedTerms = normalizeLocks(snapshot.lockedTerms);

  return {
    outputKind: OUTPUT_KIND[taskType],
    profile: {
      projectTitle: boundedString(snapshot.projectTitle, '未命名科研写作任务', 120),
      taskType,
      sectionType,
      targetJournal: boundedString(snapshot.targetJournal, '', 160),
      lockedTerms,
    },
    summary: boundedString(current.summary, '历史分析结果已恢复，请作者继续逐条核对。', 2_000),
    revisedText: boundedString(current.revisedText, snapshot.sourceText, 48_000),
    issues: normalizeIssues(current.issues),
    generatedAt: boundedString(current.generatedAt, snapshot.savedAt || new Date().toISOString(), 80),
  };
}
""",
    """  const lockedTerms = normalizeLocks(snapshot.lockedTerms);
  const revisedCandidate = boundedString(current.revisedText, '', 48_000);
  const generatedFallback = validTimestamp(snapshot.savedAt, new Date().toISOString());

  return {
    outputKind: OUTPUT_KIND[taskType],
    profile: {
      projectTitle: nonEmptyString(snapshot.projectTitle, '未命名科研写作任务', 120),
      taskType,
      sectionType,
      targetJournal: boundedString(snapshot.targetJournal, '', 160),
      lockedTerms,
    },
    summary: nonEmptyString(current.summary, '历史分析结果已恢复，请作者继续逐条核对。', 2_000),
    revisedText: revisedCandidate.trim() ? revisedCandidate : snapshot.sourceText,
    issues: normalizeIssues(current.issues),
    generatedAt: validTimestamp(current.generatedAt, generatedFallback),
  };
}
""",
)
replace_once(
    'lib/workspace-store.ts',
    """  const base = {
    ...value,
    projectTitle: boundedString(value.projectTitle, '未命名科研写作任务', 120),
    taskType,
    sourceText,
    targetJournal: boundedString(value.targetJournal, '', 160),
    sectionType,
    lockedTerms,
    requestId: boundedString(value.requestId, '', 120),
    savedAt: boundedString(value.savedAt, new Date().toISOString(), 80),
  } as ReviewSnapshot;
  const result = normalizeResult(value.result, base);
  const decisions = normalizeDecisions(value.decisions, result.issues);
  const edits = normalizeAppliedEdits(
    sourceText,
    Array.isArray(value.appliedEdits) ? value.appliedEdits : [],
  ).valid;

  return {
    id: boundedString(value.id, crypto.randomUUID(), 120),
""",
    """  const now = new Date().toISOString();
  const base = {
    ...value,
    projectTitle: nonEmptyString(value.projectTitle, '未命名科研写作任务', 120),
    taskType,
    sourceText,
    targetJournal: boundedString(value.targetJournal, '', 160),
    sectionType,
    lockedTerms,
    requestId: boundedString(value.requestId, '', 120),
    savedAt: validTimestamp(value.savedAt, now),
  } as ReviewSnapshot;
  const result = normalizeResult(value.result, base);
  const decisions = normalizeDecisions(value.decisions, result.issues);
  const issueIds = new Set(result.issues.map((issue) => issue.id));
  const edits = normalizeAppliedEdits(
    sourceText,
    Array.isArray(value.appliedEdits) ? value.appliedEdits : [],
  ).valid.filter((edit) => issueIds.has(edit.issueId));

  return {
    id: nonEmptyString(value.id, crypto.randomUUID(), 120),
""",
)
replace_once(
    'lib/workspace-store.ts',
    """      history = parsed.filter(supportedSnapshot).map(normalizeSnapshot).slice(0, MAX_HISTORY);
""",
    """      history = uniqueSnapshots(parsed.filter(supportedSnapshot).map(normalizeSnapshot)).slice(0, MAX_HISTORY);
""",
)
replace_once(
    'lib/workspace-store.ts',
    """  const normalized = history
    .filter(supportedSnapshot)
    .map(normalizeSnapshot)
    .slice(0, MAX_HISTORY);
""",
    """  const normalized = uniqueSnapshots(history
    .filter(supportedSnapshot)
    .map(normalizeSnapshot))
    .slice(0, MAX_HISTORY);
""",
)
replace_once(
    'lib/workspace-store.ts',
    """    history: value.history
      .filter(supportedSnapshot)
      .map(normalizeSnapshot)
      .slice(0, MAX_HISTORY),
""",
    """    history: uniqueSnapshots(value.history
      .filter(supportedSnapshot)
      .map(normalizeSnapshot))
      .slice(0, MAX_HISTORY),
""",
)

# Regression coverage for duplicate snapshots, empty IDs, and ghost edits.
append_before_last(
    'tests/workspace-store.test.ts',
    "\n});\n",
    """

  it('deduplicates restored snapshot IDs and repairs empty identifiers', () => {
    const first = snapshot({ id: 'duplicate' });
    const second = snapshot({ id: 'duplicate', projectTitle: 'Second copy' });
    const empty = snapshot({ id: '', projectTitle: '' });
    const state = readWorkspaceState(memoryStorage({
      [STORAGE_KEYS.history]: JSON.stringify([first, second, empty]),
    }));
    expect(state.history).toHaveLength(2);
    expect(state.history[0]?.id).toBe('duplicate');
    expect(state.history[1]?.id).not.toBe('');
    expect(state.history[1]?.projectTitle).toBe('未命名科研写作任务');
  });

  it('drops valid-looking edits that do not belong to a restored issue', () => {
    const sourceText = 'The tests was conducted.';
    const stored = snapshot({
      sourceText,
      result: {
        ...snapshot().result as Record<string, unknown>,
        issues: [],
      },
      appliedEdits: [{
        issueId: 'ghost', start: 0, end: sourceText.length, original: sourceText,
        revised: 'The tests were conducted.', appliedAt: '2026-07-31T00:00:00.000Z',
      }],
    });
    const restored = readWorkspaceState(memoryStorage({
      [STORAGE_KEYS.history]: JSON.stringify([stored]),
    })).history[0];
    expect(restored?.appliedEdits).toEqual([]);
    expect(restored?.result.revisedText).toBe(sourceText);
  });
""",
)

print('Applied final edge-case fixes.')
