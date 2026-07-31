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


# 6. Make local storage and backup operations failure-safe.
replace_once(
    'components/workspace-hub.tsx',
    """type ServiceState = 'checking' | 'ready' | 'unconfigured' | 'offline';
""",
    """type ServiceState = 'checking' | 'ready' | 'unconfigured' | 'offline';
const BACKUP_MAX_BYTES = 5 * 1024 * 1024;

function setSessionView(view: View) {
  try {
    window.sessionStorage.setItem(STORAGE_KEYS.hubView, view);
  } catch {
    // Restricted browser storage should not block navigation.
  }
}
""",
)
replace_once(
    'components/workspace-hub.tsx',
    """    refresh();
    if (window.sessionStorage.getItem(STORAGE_KEYS.hubView) === 'workbench') setView('workbench');
""",
    """    refresh();
    try {
      if (window.sessionStorage.getItem(STORAGE_KEYS.hubView) === 'workbench') setView('workbench');
    } catch {
      // Restricted browser storage should not block the home screen.
    }
""",
)
replace_once(
    'components/workspace-hub.tsx',
    """    setView('workbench');
    window.sessionStorage.setItem(STORAGE_KEYS.hubView, 'workbench');
""",
    """    setView('workbench');
    setSessionView('workbench');
""",
)
replace_once(
    'components/workspace-hub.tsx',
    """    window.sessionStorage.setItem(STORAGE_KEYS.hubView, 'hub');
""",
    """    setSessionView('hub');
""",
)
replace_once(
    'components/workspace-hub.tsx',
    """  function deleteSnapshot(snapshot: ReviewSnapshot) {
    if (!window.confirm(`删除“${snapshot.projectTitle}”的本地任务记录？`)) return;
    const next = state.history.filter((item) => item.id !== snapshot.id);
    writeWorkspaceHistory(window.localStorage, next);
    setState((current) => ({ ...current, history: next }));
  }

  function exportBackup() {
    downloadJson(
      `scholarforge-backup-${new Date().toISOString().slice(0, 10)}.json`,
      createWorkspaceBackup(window.localStorage),
    );
  }
""",
    """  function deleteSnapshot(snapshot: ReviewSnapshot) {
    if (!window.confirm(`删除“${snapshot.projectTitle}”的本地任务记录？`)) return;
    const next = state.history.filter((item) => item.id !== snapshot.id);
    try {
      writeWorkspaceHistory(window.localStorage, next);
      setState((current) => ({ ...current, history: next }));
    } catch {
      setState((current) => ({
        ...current,
        warnings: Array.from(new Set([...current.warnings, '删除任务记录失败，浏览器可能阻止了本地存储。'])),
      }));
    }
  }

  function exportBackup() {
    try {
      downloadJson(
        `scholarforge-backup-${new Date().toISOString().slice(0, 10)}.json`,
        createWorkspaceBackup(window.localStorage),
      );
    } catch {
      setState((current) => ({
        ...current,
        warnings: Array.from(new Set([...current.warnings, '本地备份导出失败，请检查浏览器存储权限。'])),
      }));
    }
  }
""",
)
replace_once(
    'components/workspace-hub.tsx',
    """    try {
      const backup = parseWorkspaceBackup(JSON.parse(await file.text()) as unknown);
      if (!window.confirm(`恢复 ${backup.history.length} 条历史记录，并替换当前本地草稿？`)) return;
      writeWorkspaceDraft(window.localStorage, backup.draft);
      writeWorkspaceHistory(window.localStorage, backup.history);
      refresh();
    } catch (caught) {
""",
    """    try {
      if (file.size > BACKUP_MAX_BYTES) throw new Error('备份文件超过 5 MB，请检查是否选择了正确文件。');
      const backup = parseWorkspaceBackup(JSON.parse(await file.text()) as unknown);
      if (!window.confirm(`恢复 ${backup.history.length} 条历史记录，并替换当前本地草稿？`)) return;
      const previousDraft = window.localStorage.getItem(STORAGE_KEYS.draft);
      const previousHistory = window.localStorage.getItem(STORAGE_KEYS.history);
      try {
        writeWorkspaceDraft(window.localStorage, backup.draft);
        writeWorkspaceHistory(window.localStorage, backup.history);
      } catch (writeError) {
        if (previousDraft === null) window.localStorage.removeItem(STORAGE_KEYS.draft);
        else window.localStorage.setItem(STORAGE_KEYS.draft, previousDraft);
        if (previousHistory === null) window.localStorage.removeItem(STORAGE_KEYS.history);
        else window.localStorage.setItem(STORAGE_KEYS.history, previousHistory);
        throw writeError;
      }
      refresh();
    } catch (caught) {
""",
)
replace_once(
    'components/workspace-hub.tsx',
    """  function clearData() {
    if (!window.confirm('清除当前浏览器中的草稿和任务历史？此操作无法撤销。')) return;
    window.localStorage.removeItem(STORAGE_KEYS.draft);
    window.localStorage.removeItem(STORAGE_KEYS.history);
    window.localStorage.removeItem(STORAGE_KEYS.authorEditingSession);
    setState({ draft: null, history: [], warnings: [] });
  }
""",
    """  function clearData() {
    if (!window.confirm('清除当前浏览器中的草稿和任务历史？此操作无法撤销。')) return;
    try {
      window.localStorage.removeItem(STORAGE_KEYS.draft);
      window.localStorage.removeItem(STORAGE_KEYS.history);
      window.localStorage.removeItem(STORAGE_KEYS.authorEditingSession);
      setState({ draft: null, history: [], warnings: [] });
    } catch {
      setState((current) => ({
        ...current,
        warnings: Array.from(new Set([...current.warnings, '清除本地数据失败，浏览器可能阻止了存储操作。'])),
      }));
    }
  }
""",
)

# 7. Preserve submitted text exactly and reject invalid API enums.
replace_once(
    'app/api/review/route.ts',
    """import { NextResponse } from 'next/server';
import { reviewWithBailian } from '@/lib/bailian';
""",
    """import { NextResponse } from 'next/server';
import { WORKSPACE_TEXT_LIMIT } from '@/lib/app-config';
import { reviewWithBailian } from '@/lib/bailian';
""",
)
replace_once(
    'app/api/review/route.ts',
    """function sanitizeLocks(value: unknown): TerminologyLock[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).flatMap((item, index) => {
""",
    """function sanitizeLocks(value: unknown): TerminologyLock[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.slice(0, 12).flatMap((item, index) => {
""",
)
replace_once(
    'app/api/review/route.ts',
    """    if (!source || !preferred) return [];
    return [{
      id: typeof record.id === 'string' ? record.id.slice(0, 80) : `lock-${index + 1}`,
      source,
      preferred,
      note,
    }];
""",
    """    if (!source || !preferred) return [];
    const requestedId = typeof record.id === 'string' ? record.id.slice(0, 80) : '';
    let id = requestedId || `lock-${index + 1}`;
    while (seen.has(id)) id = `${id}-${index + 1}`;
    seen.add(id);
    return [{ id, source, preferred, note }];
""",
)
replace_once(
    'app/api/review/route.ts',
    """    const taskType = VALID_TASKS.has(body.taskType as WorkspaceTask)
      ? body.taskType as WorkspaceTask
      : 'precheck';
    const text = typeof body.text === 'string' ? body.text.trim() : '';
""",
    """    if (body.taskType !== undefined && !VALID_TASKS.has(body.taskType as WorkspaceTask)) {
      return noStoreJson({ error: '不支持的任务类型。', requestId }, 400);
    }
    if (body.sectionType !== undefined && !VALID_SECTIONS.has(body.sectionType as ReviewSection)) {
      return noStoreJson({ error: '不支持的论文章节类型。', requestId }, 400);
    }
    const taskType = body.taskType as WorkspaceTask || 'precheck';
    const text = typeof body.text === 'string' ? body.text : '';
""",
)
replace_once(
    'app/api/review/route.ts',
    """    if (text.length < 40) {
      return noStoreJson({ error: '请至少提供 40 个字符后再开始分析。', requestId }, 400);
    }

    if (text.length > 12_000) {
      return noStoreJson({ error: '当前工作台单次最多处理 12,000 个字符。', requestId }, 400);
    }
""",
    """    if (text.trim().length < 40) {
      return noStoreJson({ error: '请至少提供 40 个字符后再开始分析。', requestId }, 400);
    }

    if (text.length > WORKSPACE_TEXT_LIMIT) {
      return noStoreJson({ error: `当前工作台单次最多处理 ${WORKSPACE_TEXT_LIMIT.toLocaleString('en-US')} 个字符。`, requestId }, 400);
    }
""",
)

# 8. Bound model responses, parse upstream errors safely, and require a real language output.
replace_once(
    'lib/bailian.ts',
    """const AGENT_IDS: AgentId[] = ['terminology', 'language', 'logic', 'method'];
""",
    """const AGENT_IDS: AgentId[] = ['terminology', 'language', 'logic', 'method'];
const MAX_REVISED_TEXT = 48_000;
const MAX_ISSUE_TEXT = 4_000;
""",
)
replace_once(
    'lib/bailian.ts',
    """function stripJsonFence(value: string) {
  return value.trim().replace(/^```(?:json)?\\s*/i, '').replace(/\\s*```$/, '').trim();
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}
""",
    """function stripJsonFence(value: string) {
  const stripped = value.trim().replace(/^```(?:json)?\\s*/i, '').replace(/\\s*```$/, '').trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  return start >= 0 && end > start ? stripped.slice(start, end + 1) : stripped;
}

function asString(value: unknown, fallback = '', max = 2_000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : fallback;
}
""",
)
replace_once(
    'lib/bailian.ts',
    """    summary: asString(data.summary, `${agent} completed its audit.`),
    revisedText: asString(data.revisedText),
""",
    """    summary: asString(data.summary, `${agent} completed its audit.`, 2_000),
    revisedText: asString(data.revisedText, '', MAX_REVISED_TEXT),
""",
)
replace_once(
    'lib/bailian.ts',
    """        location: asString(issue.location, 'Location not specified'),
        original: asString(issue.original),
        revised: asString(issue.revised),
        reason: asString(issue.reason, 'Specialist review recommended an author check.'),
        category: asString(issue.category, 'Academic writing'),
""",
    """        location: asString(issue.location, 'Location not specified', 240),
        original: asString(issue.original, '', MAX_ISSUE_TEXT),
        revised: asString(issue.revised, '', MAX_ISSUE_TEXT),
        reason: asString(issue.reason, 'Specialist review recommended an author check.', 2_000),
        category: asString(issue.category, 'Academic writing', 240),
""",
)
replace_once(
    'lib/bailian.ts',
    """        temperature: agent === 'language' ? 0.15 : 0.1,
        response_format: { type: 'json_object' },
""",
    """        temperature: agent === 'language' ? 0.15 : 0.1,
        max_tokens: 8192,
        response_format: { type: 'json_object' },
""",
)
replace_once(
    'lib/bailian.ts',
    """    const body = await response.json() as ChatCompletionResponse;
    if (!response.ok) throw new Error(body.error?.message || `${agent} failed with status ${response.status}.`);
    const content = body.choices?.[0]?.message?.content;
""",
    """    const rawBody = await response.text();
    let body: ChatCompletionResponse = {};
    try {
      body = JSON.parse(rawBody) as ChatCompletionResponse;
    } catch {
      if (!response.ok) throw new Error(`${agent} failed with status ${response.status}.`);
      throw new Error(`${agent} returned a non-JSON response.`);
    }
    if (!response.ok) throw new Error(body.error?.message || `${agent} failed with status ${response.status}.`);
    const content = body.choices?.[0]?.message?.content;
""",
)
replace_once(
    'lib/bailian.ts',
    """  } catch {
    return {
      agent,
      status: 'failed',
      payload: { summary: '', revisedText: '', issues: [] },
    };
""",
    """  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown specialist error.';
    console.warn(`[ScholarForge:${agent}] ${message}`);
    return {
      agent,
      status: 'failed',
      payload: { summary: '', revisedText: '', issues: [] },
    };
""",
)
replace_once(
    'lib/bailian.ts',
    """  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error('DASHSCOPE_API_KEY is not configured.');

  const baseUrl = (process.env.DASHSCOPE_BASE_URL || DEFAULT_BASE_URL).replace(/\\/$/, '');
  const model = process.env.DASHSCOPE_MODEL || DEFAULT_MODEL;
""",
    """  const apiKey = process.env.DASHSCOPE_API_KEY?.trim();
  if (!apiKey) throw new Error('DASHSCOPE_API_KEY is not configured.');

  const baseUrl = (process.env.DASHSCOPE_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\\/$/, '');
  const model = process.env.DASHSCOPE_MODEL?.trim() || DEFAULT_MODEL;
""",
)
replace_once(
    'lib/bailian.ts',
    """  if ((taskType === 'translate' || taskType === 'polish') && !languageExecution?.payload.revisedText) {
    throw new Error('The primary language output did not complete.');
  }
  if (taskType === 'precheck' && completed.length < 2) {
""",
    """  if (!languageExecution?.payload.revisedText) {
    throw new Error('The primary language output did not complete.');
  }
  if (taskType === 'precheck' && completed.length < 2) {
""",
)
replace_once(
    'lib/bailian.ts',
    """  return (value.match(/[-+]?\\d+(?:,\\d{3})*(?:\\.\\d+)?/g) || [])
""",
    """  return (value.match(/[-+]?(?:\\d+(?:,\\d{3})*(?:\\.\\d+)?|\\.\\d+)(?:[eE][-+]?\\d+)?/g) || [])
""",
)

# 9. Add regression tests for the fixed edge cases.
replace_once(
    'tests/author-editing.test.ts',
    """import { analyseIssueAnchor, composeWorkingText, createAppliedEdit } from '@/lib/author-editing';
""",
    """import { analyseIssueAnchor, composeWorkingText, createAppliedEdit, normalizeAppliedEdits } from '@/lib/author-editing';
""",
)
append_before_last(
    'tests/author-editing.test.ts',
    "\n});\n",
    """

  it('rejects cross-line and broader author placeholders', () => {
    const crossLine = { ...issue, original: 'The tests was\\nconducted.', revised: 'The tests were conducted.' };
    expect(analyseIssueAnchor(crossLine.original, crossLine, []).state).toBe('manual');
    expect(analyseIssueAnchor(issue.original, { ...issue, revised: '[Author to confirm sample count]' }, []).state).toBe('manual');
  });

  it('drops persisted edits with invalid ranges, mismatched anchors, or overlaps', () => {
    const source = 'Alpha beta gamma.';
    const valid = {
      issueId: 'valid', start: 6, end: 10, original: 'beta', revised: 'BETA', appliedAt: '2026-07-31T00:00:00.000Z',
    };
    const invalid = {
      issueId: 'invalid', start: 0, end: 5, original: 'wrong', revised: 'ALPHA', appliedAt: '2026-07-31T00:00:00.000Z',
    };
    const overlap = {
      issueId: 'overlap', start: 7, end: 12, original: 'eta g', revised: 'X', appliedAt: '2026-07-31T00:00:00.000Z',
    };
    const normalized = normalizeAppliedEdits(source, [valid, invalid, overlap]);
    expect(normalized.valid.map((edit) => edit.issueId)).toEqual(['valid']);
    expect(composeWorkingText(source, [valid, invalid, overlap])).toBe('Alpha BETA gamma.');
  });
""",
)
append_before_last(
    'tests/workspace-store.test.ts',
    "\n});\n",
    """

  it('sanitizes invalid decisions and persisted edits before restoring history', () => {
    const sourceText = 'The tests was conducted.';
    const stored = snapshot({
      sourceText,
      result: {
        ...snapshot().result as Record<string, unknown>,
        issues: [{
          id: 'issue-1', agent: 'language', severity: 'minor', location: 'P1', original: sourceText,
          revised: 'The tests were conducted.', reason: 'Grammar', category: 'Grammar', meaningChanged: false,
        }],
      },
      decisions: { 'issue-1': 'not-a-decision', ghost: 'accepted' },
      appliedEdits: [{
        issueId: 'issue-1', start: 0, end: 4, original: 'Wrong', revised: 'The', appliedAt: '2026-07-31T00:00:00.000Z',
      }],
    });
    const state = readWorkspaceState(memoryStorage({ [STORAGE_KEYS.history]: JSON.stringify([stored]) }));
    expect(state.history[0]?.decisions).toEqual({});
    expect(state.history[0]?.appliedEdits).toEqual([]);
  });

  it('normalizes duplicate issue and terminology identifiers', () => {
    const stored = snapshot({
      lockedTerms: [
        { id: 'same', source: 'A', preferred: 'Alpha' },
        { id: 'same', source: 'B', preferred: 'Beta' },
      ],
      result: {
        ...snapshot().result as Record<string, unknown>,
        issues: [
          { id: 'same', agent: 'language', severity: 'minor', location: 'P1', original: 'A', revised: 'B', reason: 'R', category: 'C', meaningChanged: false },
          { id: 'same', agent: 'logic', severity: 'major', location: 'P2', original: 'C', revised: 'D', reason: 'R', category: 'C', meaningChanged: true },
        ],
      },
    });
    const restored = readWorkspaceState(memoryStorage({ [STORAGE_KEYS.history]: JSON.stringify([stored]) })).history[0];
    expect(new Set(restored?.lockedTerms.map((lock) => lock.id)).size).toBe(2);
    expect(new Set(restored?.result.issues.map((item) => item.id)).size).toBe(2);
  });
""",
)


print('Applied reliability fixes part 4.')
