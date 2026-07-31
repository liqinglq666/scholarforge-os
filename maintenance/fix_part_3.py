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


# 5. Make the workbench selection, rerun, timeout, and apply behavior consistent.
replace_once(
    'components/workbench/evidence-workbench.tsx',
    """  const selectedItem = evidenceItems.find((item) => item.issue.id === selectedIssueId) || evidenceItems[0];
  const selectedIndex = selectedItem ? evidenceItems.findIndex((item) => item.issue.id === selectedItem.issue.id) : -1;
""",
    """  const selectedItem = filteredItems.find((item) => item.issue.id === selectedIssueId) || filteredItems[0];
  const selectedIndex = selectedItem ? filteredItems.findIndex((item) => item.issue.id === selectedItem.issue.id) : -1;
""",
)
replace_once(
    'components/workbench/evidence-workbench.tsx',
    """  useEffect(() => {
    if (!loading) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsedMs(Date.now() - startedAt), 200);
    return () => window.clearInterval(timer);
  }, [loading]);
""",
    """  useEffect(() => {
    if (!loading) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsedMs(Date.now() - startedAt), 200);
    return () => window.clearInterval(timer);
  }, [loading]);

  useEffect(() => {
    if (!filteredItems.length) {
      if (selectedIssueId !== null) setSelectedIssueId(null);
      return;
    }
    if (!filteredItems.some((item) => item.issue.id === selectedIssueId)) {
      setSelectedIssueId(filteredItems[0].issue.id);
    }
  }, [filteredItems, selectedIssueId]);
""",
)
replace_once(
    'components/workbench/evidence-workbench.tsx',
    """  async function runWorkflow() {
    if (!inputValid || loading) return;
    setLoading(true);
    setElapsedMs(0);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectTitle, taskType, text: sourceText, targetJournal, sectionType, lockedTerms }),
      });
      const payload = await response.json() as ReviewPayload;
      if (!response.ok) throw new Error(payload.detail || payload.error || '工作流请求失败。');
      if (!Array.isArray(payload.issues) || typeof payload.revisedText !== 'string') throw new Error('工作流返回的数据结构不完整。');
      const nextId = crypto.randomUUID();
      const nextDecisions = Object.fromEntries(payload.issues.map((issue) => [issue.id, 'pending'])) as Record<string, IssueDecision>;
      const nextRequestId = payload.requestId || '';
      const snapshot: ReviewSnapshot = {
        id: nextId,
        projectTitle: projectTitle.trim() || '未命名科研写作任务',
        taskType,
        sourceText,
        targetJournal,
        sectionType,
        lockedTerms,
        requestId: nextRequestId,
        result: payload,
        decisions: nextDecisions,
        appliedEdits: [],
        savedAt: new Date().toISOString(),
      };
      setResult(payload);
      setRequestId(nextRequestId);
      setSnapshotId(nextId);
      setDecisions(nextDecisions);
      setAppliedEdits([]);
      setUndoStack([]);
      setRedoStack([]);
      setSelectedIssueId(payload.issues[0]?.id || null);
      setCanvasView('suggested');
      setMobilePanel('evidence');
      onSnapshotChanged(snapshot);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '任务失败，请检查服务配置后重试。');
    } finally {
      setLoading(false);
    }
  }
""",
    """  async function runWorkflow(textOverride?: string) {
    const analysisText = textOverride ?? sourceText;
    const analysisValid = analysisText.trim().length >= minimum && analysisText.length <= WORKSPACE_TEXT_LIMIT;
    if (!analysisValid || loading) return;
    setLoading(true);
    setElapsedMs(0);
    setError('');
    setNotice('');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 65_000);
    try {
      const response = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectTitle, taskType, text: analysisText, targetJournal, sectionType, lockedTerms }),
        signal: controller.signal,
      });
      const raw = await response.text();
      let payload: ReviewPayload;
      try {
        payload = JSON.parse(raw) as ReviewPayload;
      } catch {
        throw new Error(response.ok ? '分析服务返回了无法识别的结果。' : `分析服务暂不可用（HTTP ${response.status}）。`);
      }
      if (!response.ok) throw new Error(payload.detail || payload.error || '工作流请求失败。');
      if (!Array.isArray(payload.issues) || typeof payload.revisedText !== 'string') throw new Error('工作流返回的数据结构不完整。');
      const nextId = crypto.randomUUID();
      const nextDecisions = Object.fromEntries(payload.issues.map((issue) => [issue.id, 'pending'])) as Record<string, IssueDecision>;
      const nextRequestId = payload.requestId || '';
      const snapshot: ReviewSnapshot = {
        id: nextId,
        projectTitle: projectTitle.trim() || '未命名科研写作任务',
        taskType,
        sourceText: analysisText,
        targetJournal,
        sectionType,
        lockedTerms,
        requestId: nextRequestId,
        result: payload,
        decisions: nextDecisions,
        appliedEdits: [],
        savedAt: new Date().toISOString(),
      };
      if (analysisText !== sourceText) setSourceText(analysisText);
      setResult(payload);
      setRequestId(nextRequestId);
      setSnapshotId(nextId);
      setDecisions(nextDecisions);
      setAppliedEdits([]);
      setUndoStack([]);
      setRedoStack([]);
      setSelectedIssueId(payload.issues[0]?.id || null);
      setCanvasView('suggested');
      setMobilePanel('evidence');
      onSnapshotChanged(snapshot);
    } catch (caught) {
      const message = caught instanceof DOMException && caught.name === 'AbortError'
        ? '分析请求超时，请缩短文本后重试。'
        : caught instanceof Error ? caught.message : '任务失败，请检查服务配置后重试。';
      setError(message);
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  }
""",
)
replace_once(
    'components/workbench/evidence-workbench.tsx',
    """  function addLock() {
    if (!lockSource.trim() || !lockPreferred.trim() || lockedTerms.length >= 12) return;
    setLockedTerms((current) => [...current, { id: crypto.randomUUID(), source: lockSource.trim(), preferred: lockPreferred.trim() }]);
    setLockSource('');
    setLockPreferred('');
  }

  function moveIssue(offset: number) {
    if (!evidenceItems.length) return;
    const index = selectedIndex < 0 ? 0 : (selectedIndex + offset + evidenceItems.length) % evidenceItems.length;
    setSelectedIssueId(evidenceItems[index].issue.id);
  }
""",
    """  function addLock() {
    const source = lockSource.trim();
    const preferred = lockPreferred.trim();
    if (!source || !preferred) return;
    if (lockedTerms.length >= 12) {
      setNotice('最多可以设置 12 条术语锁。');
      return;
    }
    if (lockedTerms.some((lock) => lock.source.toLowerCase() === source.toLowerCase())) {
      setNotice('这个原词已经设置过术语锁。');
      return;
    }
    setLockedTerms((current) => [...current, { id: crypto.randomUUID(), source, preferred }]);
    setLockSource('');
    setLockPreferred('');
  }

  function moveIssue(offset: number) {
    if (!filteredItems.length) return;
    const index = selectedIndex < 0 ? 0 : (selectedIndex + offset + filteredItems.length) % filteredItems.length;
    setSelectedIssueId(filteredItems[index].issue.id);
  }
""",
)
replace_once(
    'components/workbench/evidence-workbench.tsx',
    """  const selectedAnchorReady = selectedAnalysis?.state === 'applied' || selectedAnalysis?.state.startsWith('safe');
""",
    """  const selectedAnchorReady = selectedAnalysis?.state === 'applied' || selectedAnalysis?.state.startsWith('safe');
  const selectedCanApply = selectedAnalysis?.state === 'safe-exact' || selectedAnalysis?.state === 'safe-whitespace';
""",
)
replace_once(
    'components/workbench/evidence-workbench.tsx',
    """              {result ? <button disabled={!inputValid || loading} onClick={() => void runWorkflow()} type="button"><Icon name="spark" />重新分析当前文本</button> : null}
""",
    """              {result ? <button disabled={workingText.trim().length < minimum || workingText.length > WORKSPACE_TEXT_LIMIT || loading} onClick={() => void runWorkflow(workingText)} type="button"><Icon name="spark" />重新分析工作稿</button> : null}
""",
)
replace_once(
    'components/workbench/evidence-workbench.tsx',
    """                  <button className="sf-button is-primary is-full" disabled={selectedItem.decision !== 'accepted' || selectedItem.applied} onClick={() => applyIssue(selectedItem.issue)} type="button">{selectedItem.applied ? '已应用到工作稿' : '应用到工作稿'} <Icon name="arrow-right" /></button>
""",
    """                  <button className="sf-button is-primary is-full" disabled={selectedItem.decision !== 'accepted' || selectedItem.applied || !selectedCanApply} onClick={() => applyIssue(selectedItem.issue)} type="button">{selectedItem.applied ? '已应用到工作稿' : selectedCanApply ? '应用到工作稿' : '需要手动修改'} <Icon name="arrow-right" /></button>
""",
)
replace_once(
    'components/workbench/evidence-workbench.tsx',
    """                  <div className="sf-term-add"><input onChange={(event) => setLockSource(event.target.value)} placeholder="原词" value={lockSource} /><input onChange={(event) => setLockPreferred(event.target.value)} placeholder="规范表达" value={lockPreferred} /><button aria-label="添加术语锁" disabled={!lockSource.trim() || !lockPreferred.trim()} onClick={addLock} type="button"><Icon name="plus" size={16} /></button></div>
""",
    """                  <div className="sf-term-add"><input onChange={(event) => setLockSource(event.target.value)} placeholder="原词" value={lockSource} /><input onChange={(event) => setLockPreferred(event.target.value)} placeholder="规范表达" value={lockPreferred} /><button aria-label="添加术语锁" disabled={!lockSource.trim() || !lockPreferred.trim() || lockedTerms.length >= 12} onClick={addLock} type="button"><Icon name="plus" size={16} /></button></div>
""",
)


print('Applied reliability fixes part 3.')
