'use client';

import { useMemo, useState } from 'react';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { StatusBanner } from '@/components/feedback/status-banner';
import { SafetyGatePanel } from '@/components/review/safety-gate-panel';
import { SECTION_LABELS, TASK_LABELS } from '@/lib/config';
import {
  analyzeIssueAnchor,
  applyIssueToWorkspace,
  issueDecisionRequiresAppliedEditRemoval,
  redoWorkspace,
  removeAppliedIssueFromWorkspace,
  setIssueDecisionInWorkspace,
  undoWorkspace,
} from '@/lib/editing/apply';
import { exportCleanDocx, exportReviewReport, exportWorkingText } from '@/lib/exports/files';
import type { IssueDecision, IssueSeverity, ReviewIssue, WorkspaceState } from '@/lib/types';

type TextView = 'author' | 'suggested' | 'original';
type DecisionFilter = 'all' | IssueDecision;
type SeverityFilter = 'all' | IssueSeverity;
type WorkbenchStage = 'review' | 'edit' | 'export';
type PassportGateState = 'passed' | 'quarantined' | 'unverified';

const DECISION_LABELS: Record<IssueDecision, string> = {
  pending: '待处理',
  accepted: '已接受',
  rejected: '已拒绝',
  deferred: '暂缓',
};

const SEVERITY_LABELS: Record<IssueSeverity, string> = {
  major: '重大',
  minor: '一般',
  suggestion: '建议',
};

function IssueDetail({
  issue,
  decision,
  workspace,
  applicationBlockedReason,
  gateState,
  onDecision,
  onApply,
  onRemove,
}: {
  issue: ReviewIssue;
  decision: IssueDecision;
  workspace: WorkspaceState;
  applicationBlockedReason: string;
  gateState: PassportGateState;
  onDecision: (decision: IssueDecision) => void;
  onApply: () => void;
  onRemove: () => void;
}) {
  const anchor = analyzeIssueAnchor(workspace.workingText, issue, workspace.appliedEdits);
  const applied = workspace.appliedEdits.some((edit) => edit.issueId === issue.id);
  const anchorSafe = anchor.state === 'safe-exact' || anchor.state === 'safe-whitespace';
  const canApply = !applicationBlockedReason && anchorSafe;
  const applicationMessage = applicationBlockedReason || anchor.message;
  const passportIdPart = issue.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase() || 'ISSUE';
  const passportGateLabel = gateState === 'quarantined' ? 'BLOCKED' : gateState === 'unverified' ? 'UNVERIFIED' : 'PASSED';
  const passportState = applied
    ? 'applied'
    : gateState === 'quarantined'
      ? 'quarantined'
      : gateState === 'unverified'
        ? 'legacy_unverified'
        : 'author_review';
  const passportPermission = applied
    ? '作者已授权并应用'
    : applicationBlockedReason
      ? '禁止自动应用'
      : canApply
        ? '具备局部定位条件，仍需作者接受'
        : '当前定位不安全，禁止自动应用';

  return (
    <article className="review-detail issue-detail" aria-labelledby={`issue-title-${issue.id}`}>
      <header>
        <div><span className={`severity severity-${issue.severity}`}>{SEVERITY_LABELS[issue.severity]}</span><span>{issue.category}</span></div>
        <span className={`decision-state decision-${decision}`}>{DECISION_LABELS[decision]}</span>
      </header>
      <h2 id={`issue-title-${issue.id}`}>{issue.location}</h2>

      <section className="edit-passport" aria-label="Verified Edit Passport 科研修改通行证">
        <header>
          <div><span>Verified Edit Passport</span><strong>科研修改通行证</strong></div>
          <b className={`edit-passport-state passport-gate-${gateState}`}>{passportGateLabel}</b>
        </header>
        <dl>
          <div><dt>通行证编号</dt><dd>VEP-{passportIdPart}</dd></div>
          <div><dt>修改类型 / 检查域</dt><dd>{issue.category}</dd></div>
          <div><dt>Safety Gate</dt><dd>{passportGateLabel}</dd></div>
          <div><dt>状态</dt><dd>{passportState}</dd></div>
          <div><dt>自动应用</dt><dd>{passportPermission}</dd></div>
          <div><dt>局部定位证据</dt><dd>{anchor.message}</dd></div>
          <div><dt>最终控制者</dt><dd>作者</dd></div>
        </dl>
        <p className="edit-passport-note">通行证记录的是这条候选修改当前通过了哪些权限检查；PASSED 只代表未被当前规则阻断，不代表科学正确。</p>
      </section>

      <div className="evidence-diff">
        <section className="evidence-source"><span>原文证据</span><p>{issue.original || '没有可定位的原文证据。'}</p></section>
        <section className="evidence-candidate"><span>AI 候选修改</span><p>{issue.revised || '这是一项作者待补信息，没有可直接应用的文本。'}</p></section>
      </div>

      <section className="review-reason"><span>建议理由</span><p>{issue.reason}</p></section>
      <section className={issue.meaningChanged ? 'meaning-assessment danger' : 'meaning-assessment'}>
        <strong>{issue.meaningChanged ? '可能改变科学含义' : '未标记科学含义变化'}</strong>
        <p>{issue.authorActionRequired ? '需要作者补充或核对信息，不能直接自动应用。' : '仍需作者核对事实、语气和适用范围。'}</p>
      </section>

      <fieldset className="decision-toolbar">
        <legend>作者决定</legend>
        {(['accepted', 'rejected', 'deferred'] as IssueDecision[]).map((value) => (
          <button aria-pressed={decision === value} className={decision === value ? 'selected' : ''} key={value} onClick={() => onDecision(value)} type="button">{DECISION_LABELS[value]}</button>
        ))}
      </fieldset>

      <div className={applied || canApply ? 'application-permission allowed' : 'application-permission blocked'}>
        <span aria-hidden="true">{applied || canApply ? '✓' : '!'}</span>
        <div>
          <strong>{applied ? '已应用到作者工作稿' : applicationBlockedReason ? '安全门未授权自动应用' : canApply ? '代码允许安全定位' : '已阻止自动应用'}</strong>
          <p>{applicationMessage}</p>
        </div>
      </div>
      {applied ? (
        <button className="secondary-button full-button" onClick={onRemove} type="button">从作者工作稿撤回这一条</button>
      ) : (
        <button className="primary-button full-button" disabled={!canApply || decision !== 'accepted'} onClick={onApply} type="button">
          {applicationBlockedReason ? '当前结果不可自动应用' : decision === 'accepted' ? '应用这一条建议' : '先接受，再应用建议'}
        </button>
      )}
    </article>
  );
}

export function ReviewWorkbench({
  workspace,
  onUpdate,
  onStartNew,
}: {
  workspace: WorkspaceState;
  onUpdate: (next: WorkspaceState) => void;
  onStartNew: () => void;
}) {
  const result = workspace.currentResult;
  const [stage, setStage] = useState<WorkbenchStage>('review');
  const [textView, setTextView] = useState<TextView>('author');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>('all');
  const [selectedId, setSelectedId] = useState(result?.issues[0]?.id || '');
  const [message, setMessage] = useState('');
  const [pendingDecision, setPendingDecision] = useState<{ issueId: string; decision: IssueDecision } | null>(null);

  const filteredIssues = useMemo(() => (result?.issues || []).filter((issue) => {
    const decision = workspace.decisions[issue.id] || 'pending';
    return (severityFilter === 'all' || issue.severity === severityFilter)
      && (decisionFilter === 'all' || decision === decisionFilter);
  }), [decisionFilter, result?.issues, severityFilter, workspace.decisions]);
  const selectedIssue = filteredIssues.find((issue) => issue.id === selectedId) || filteredIssues[0] || null;
  const processed = (result?.issues || []).filter((issue) => (workspace.decisions[issue.id] || 'pending') !== 'pending').length;
  const pending = (result?.issues.length || 0) - processed;

  if (!result) return null;

  function commitDecision(issueId: string, decision: IssueDecision) {
    const removesAppliedEdit = issueDecisionRequiresAppliedEditRemoval(workspace, issueId, decision);
    onUpdate(setIssueDecisionInWorkspace(workspace, issueId, decision));
    setMessage(removesAppliedEdit
      ? `已撤回修改并记录作者决定：${DECISION_LABELS[decision]}。`
      : `已记录作者决定：${DECISION_LABELS[decision]}。`);
  }

  function setDecision(issueId: string, decision: IssueDecision) {
    if (issueDecisionRequiresAppliedEditRemoval(workspace, issueId, decision)) {
      setPendingDecision({ issueId, decision });
      return;
    }
    commitDecision(issueId, decision);
  }

  function confirmPendingDecision() {
    const pendingChange = pendingDecision;
    if (!pendingChange) return;
    setPendingDecision(null);
    commitDecision(pendingChange.issueId, pendingChange.decision);
  }

  function applyIssue(issue: ReviewIssue) {
    try {
      onUpdate(applyIssueToWorkspace(workspace, issue));
      setTextView('author');
      setStage('edit');
      setMessage('已把这一条建议应用到作者工作稿。可单独撤回，也可使用撤销恢复。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '建议无法安全应用。');
    }
  }

  function removeIssue(issue: ReviewIssue) {
    onUpdate(removeAppliedIssueFromWorkspace(workspace, issue.id));
    setTextView('author');
    setMessage('已从作者工作稿撤回这一条建议，作者决定仍保留为“已接受”。');
  }

  const safetyGateMissing = !result.safetyGate;
  const candidateQuarantined = result.safetyGate?.status === 'quarantined';
  const applicationBlockedReason = safetyGateMissing
    ? '旧版分析结果缺少安全门报告，请重新分析后再应用。'
    : candidateQuarantined
      ? '安全门已隔离完整候选稿，所有自动应用权限均已关闭。'
      : '';
  const passportGateState: PassportGateState = safetyGateMissing ? 'unverified' : candidateQuarantined ? 'quarantined' : 'passed';
  const displayedText = textView === 'original' ? workspace.draft.sourceText : textView === 'suggested' ? result.suggestedText : workspace.workingText;

  return (
    <div className="review-page">
      <nav aria-label="审校流程" className="workspace-stage-bar review-stage-bar">
        <span className="complete"><b>1</b>输入</span>
        <span className="complete"><b>2</b>分析</span>
        <button aria-current={stage === 'review' ? 'step' : undefined} className={stage === 'review' ? 'active' : ''} onClick={() => setStage('review')} type="button"><b>3</b>核对</button>
        <button aria-current={stage === 'edit' ? 'step' : undefined} className={stage === 'edit' ? 'active' : ''} onClick={() => setStage('edit')} type="button"><b>4</b>修改</button>
        <button aria-current={stage === 'export' ? 'step' : undefined} className={stage === 'export' ? 'active' : ''} onClick={() => setStage('export')} type="button"><b>5</b>导出</button>
      </nav>

      <header className="review-titlebar">
        <div>
          <span className="product-label">{TASK_LABELS[workspace.draft.taskType]} · {SECTION_LABELS[workspace.draft.sectionType]}</span>
          <h1>{workspace.draft.projectName || '未命名任务'}</h1>
          <p>{workspace.draft.targetJournal ? `写作语境：${workspace.draft.targetJournal}` : '模型候选、代码检查与作者工作稿保持分离。'}</p>
        </div>
        <div className="review-title-actions">
          <button disabled={!workspace.undoStack.length} onClick={() => onUpdate(undoWorkspace(workspace))} type="button">撤销</button>
          <button disabled={!workspace.redoStack.length} onClick={() => onUpdate(redoWorkspace(workspace))} type="button">重做</button>
          <button onClick={onStartNew} type="button">新任务</button>
        </div>
      </header>

      {message ? <p className="live-message" role="status">{message}</p> : null}

      {stage === 'review' ? (
        <>
          {safetyGateMissing ? (
            <StatusBanner tone="warning" title="旧版结果需要重新分析">当前结果没有 Safety Gate 报告，自动应用权限已关闭。原文、作者工作稿和模型候选仍可查看。</StatusBanner>
          ) : candidateQuarantined ? (
            <StatusBanner tone="danger" title="AI 候选稿已被安全门隔离">作者工作稿保持原文不变，所有自动应用权限均已关闭。你仍可以查看模型候选和阻断证据。</StatusBanner>
          ) : (
            <StatusBanner tone="warning" title="通过当前代码检查仍需作者核对">请继续核对事实、引用、统计结果、方法描述、因果边界和期刊要求。</StatusBanner>
          )}

          <SafetyGatePanel report={result.safetyGate} />

          <section className="review-overview review-summary" aria-labelledby="summary-title">
            <div><span className="product-label">分析摘要</span><h2 id="summary-title">{result.summary}</h2></div>
            <dl>
              <div><dt>问题</dt><dd>{result.issues.length}</dd></div>
              <div><dt>已处理</dt><dd>{processed}</dd></div>
              <div><dt>待处理</dt><dd>{pending}</dd></div>
              <div><dt>已应用</dt><dd>{workspace.appliedEdits.length}</dd></div>
            </dl>
          </section>

          <div className="review-editor-layout workbench-grid">
            <aside className="review-issue-column issues-panel" aria-label="审校问题">
              <div className="review-filterbar">
                <label><span>风险级别</span><select onChange={(event) => setSeverityFilter(event.target.value as SeverityFilter)} value={severityFilter}><option value="all">全部</option><option value="major">重大</option><option value="minor">一般</option><option value="suggestion">建议</option></select></label>
                <label><span>作者决定</span><select onChange={(event) => setDecisionFilter(event.target.value as DecisionFilter)} value={decisionFilter}><option value="all">全部</option><option value="pending">待处理</option><option value="accepted">已接受</option><option value="rejected">已拒绝</option><option value="deferred">暂缓</option></select></label>
              </div>
              {filteredIssues.length ? (
                <ol className="compact-issue-list">
                  {filteredIssues.map((issue) => {
                    const decision = workspace.decisions[issue.id] || 'pending';
                    const stableIndex = result.issues.findIndex((item) => item.id === issue.id) + 1;
                    return (
                      <li key={issue.id}>
                        <button aria-current={selectedIssue?.id === issue.id} onClick={() => setSelectedId(issue.id)} type="button">
                          <span>{String(stableIndex).padStart(2, '0')}</span>
                          <div><strong>{issue.category}</strong><small>{issue.location}</small></div>
                          <b className={`decision-dot decision-${decision}`}>{DECISION_LABELS[decision]}</b>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              ) : <div className="empty-state"><strong>{result.issues.length ? '当前筛选下没有问题' : '没有发现需要逐条处理的问题'}</strong><p>{result.issues.length ? '调整筛选条件查看其他问题。' : '这不等于全文不存在科研风险，请继续进行作者核对。'}</p></div>}
            </aside>

            <section className="review-detail-column">
              {selectedIssue ? <IssueDetail applicationBlockedReason={applicationBlockedReason} decision={workspace.decisions[selectedIssue.id] || 'pending'} gateState={passportGateState} issue={selectedIssue} onApply={() => applyIssue(selectedIssue)} onDecision={(decision) => setDecision(selectedIssue.id, decision)} onRemove={() => removeIssue(selectedIssue)} workspace={workspace} /> : null}
            </section>

            <section className="review-document-column document-panel" aria-labelledby="document-title">
              <header className="document-toolbar">
                <div><span className="product-label">文档视图</span><h2 id="document-title">{textView === 'author' ? '作者工作稿' : textView === 'suggested' ? (candidateQuarantined ? '已隔离的 AI 候选稿' : safetyGateMissing ? '未验证的 AI 候选稿' : 'AI 候选稿') : '原始文本'}</h2></div>
                <div className="segmented-control" role="tablist" aria-label="文本版本">
                  <button aria-label="作者工作稿" aria-selected={textView === 'author'} onClick={() => setTextView('author')} role="tab" type="button">作者稿</button>
                  <button aria-label="AI 候选稿" aria-selected={textView === 'suggested'} onClick={() => setTextView('suggested')} role="tab" type="button">AI 候选</button>
                  <button aria-selected={textView === 'original'} onClick={() => setTextView('original')} role="tab" type="button">原文</button>
                </div>
              </header>
              <div className={candidateQuarantined && textView === 'suggested' ? 'version-explanation quarantined' : 'version-explanation'}>
                {textView === 'author'
                  ? '只包含作者逐条应用的修改，可撤销、重做和导出。'
                  : textView === 'suggested'
                    ? candidateQuarantined
                      ? '该候选稿仅用于检查模型风险，不会覆盖作者工作稿。'
                      : safetyGateMissing
                        ? '该旧版候选稿缺少 Safety Gate 报告，只能查看，不能自动应用。'
                        : '模型完整候选仅供对照，不会自动覆盖作者稿。'
                    : '分析时提交的只读原始文本。'}
              </div>
              <pre className="manuscript-text" tabIndex={0}>{displayedText}</pre>
            </section>
          </div>
        </>
      ) : null}

      {stage === 'edit' ? (
        <section className="author-edit-stage" aria-labelledby="author-edit-title">
          <div className="author-edit-main">
            <header><div><span className="product-label">作者控制阶段</span><h2 id="author-edit-title">作者工作稿</h2></div><span>{workspace.workingText.length.toLocaleString()} 字符</span></header>
            <pre className="manuscript-text author-manuscript" tabIndex={0}>{workspace.workingText}</pre>
          </div>
          <aside className="author-edit-sidebar">
            <section><span className="product-label">修改状态</span><dl><div><dt>已接受</dt><dd>{result.issues.filter((issue) => workspace.decisions[issue.id] === 'accepted').length}</dd></div><div><dt>已应用</dt><dd>{workspace.appliedEdits.length}</dd></div><div><dt>待处理</dt><dd>{pending}</dd></div></dl></section>
            <section><h3>恢复操作</h3><p>撤销和重做只影响作者工作稿，不改变原文或 AI 候选。</p><div className="author-history-actions"><button disabled={!workspace.undoStack.length} onClick={() => onUpdate(undoWorkspace(workspace))} type="button">撤销上一步</button><button disabled={!workspace.redoStack.length} onClick={() => onUpdate(redoWorkspace(workspace))} type="button">重做</button></div></section>
            <button className="primary-button" onClick={() => setStage('export')} type="button">进入导出</button>
          </aside>
        </section>
      ) : null}

      {stage === 'export' ? (
        <section className="export-stage" aria-labelledby="export-title">
          <div className="export-stage-copy">
            <span className="product-label">导出作者确认版本</span>
            <h2 id="export-title">选择需要的交付文件</h2>
            <p>{pending ? `仍有 ${pending} 条问题待处理。可以导出，但应在提交或发表前逐条核对。` : '所有问题都已有作者决定。仍需进行最终事实、引用和版式核对。'}</p>
            <ul><li>导出内容来自作者工作稿，不是完整 AI 候选稿。</li><li>原始 DOCX 的复杂排版、公式、批注和修订痕迹不会原样保留。</li><li>安全门降低风险，但不替代科学与伦理审核。</li></ul>
          </div>
          <div className="export-option-list">
            <button aria-label="作者工作稿 TXT" onClick={() => exportWorkingText(workspace)} type="button"><span>TXT</span><div><strong>作者工作稿</strong><small>纯文本，适合复制到其他编辑器</small></div><b>导出</b></button>
            <button aria-label="审校报告 Markdown" onClick={() => exportReviewReport(workspace)} type="button"><span>MD</span><div><strong>审校报告</strong><small>包含问题、作者决定与安全门结果</small></div><b>导出</b></button>
            <button aria-label="清洁 DOCX" onClick={() => void exportCleanDocx(workspace)} type="button"><span>DOCX</span><div><strong>清洁文档</strong><small>根据作者工作稿重新生成</small></div><b>导出</b></button>
          </div>
        </section>
      ) : null}

      <ConfirmDialog
        cancelLabel="保留当前决定"
        confirmLabel={`撤回并改为${DECISION_LABELS[pendingDecision?.decision || 'rejected']}`}
        description="这条建议已经应用到作者工作稿。确认后会先撤回该修改，再记录新的作者决定；原始文本和 AI 候选不会改变，工作稿撤回动作仍可使用“撤销”恢复。"
        eyebrow="修改已应用建议的作者决定"
        onCancel={() => setPendingDecision(null)}
        onConfirm={confirmPendingDecision}
        open={Boolean(pendingDecision)}
        title={`撤回已应用修改并改为“${DECISION_LABELS[pendingDecision?.decision || 'rejected']}”？`}
      />
    </div>
  );
}
