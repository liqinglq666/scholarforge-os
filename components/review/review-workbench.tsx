'use client';

import { useMemo, useState } from 'react';
import { SECTION_LABELS, TASK_LABELS } from '@/lib/config';
import { analyzeIssueAnchor, applyIssueToWorkspace, redoWorkspace, undoWorkspace } from '@/lib/editing/apply';
import { exportCleanDocx, exportReviewReport, exportWorkingText } from '@/lib/exports/files';
import type { IssueDecision, IssueSeverity, ReviewIssue, WorkspaceState } from '@/lib/types';
import { StatusBanner } from '@/components/feedback/status-banner';

type TextView = 'author' | 'suggested' | 'original';
type DecisionFilter = 'all' | IssueDecision;
type SeverityFilter = 'all' | IssueSeverity;

const DECISION_LABELS: Record<IssueDecision, string> = {
  pending: '待处理',
  accepted: '接受',
  rejected: '拒绝',
  deferred: '待定',
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
  onDecision,
  onApply,
}: {
  issue: ReviewIssue;
  decision: IssueDecision;
  workspace: WorkspaceState;
  onDecision: (decision: IssueDecision) => void;
  onApply: () => void;
}) {
  const anchor = analyzeIssueAnchor(workspace.workingText, issue, workspace.appliedEdits);
  const canApply = anchor.state === 'safe-exact' || anchor.state === 'safe-whitespace';
  return (
    <article className="issue-detail" aria-labelledby={`issue-title-${issue.id}`}>
      <div className="issue-title-row">
        <span className={`severity severity-${issue.severity}`}>{SEVERITY_LABELS[issue.severity]}</span>
        <span>{issue.category}</span>
      </div>
      <h2 id={`issue-title-${issue.id}`}>{issue.location}</h2>
      <div className="evidence-block original"><span>原文证据</span><p>{issue.original || '没有可定位的原文证据。'}</p></div>
      <div className="evidence-block revised"><span>建议文本</span><p>{issue.revised || '这是一项作者待补信息，没有可直接应用的文本。'}</p></div>
      <div className="reason-block"><span>为什么提出这条建议</span><p>{issue.reason}</p></div>
      <div className={issue.meaningChanged ? 'meaning-warning danger' : 'meaning-warning'}>
        <strong>{issue.meaningChanged ? '可能改变科学含义' : '未标记科学含义变化'}</strong>
        <span>{issue.authorActionRequired ? '需要作者补充或核对信息。' : '仍需作者核对事实、语气与适用范围。'}</span>
      </div>

      <fieldset className="decision-group">
        <legend>作者决定</legend>
        {(['accepted', 'rejected', 'deferred'] as IssueDecision[]).map((value) => (
          <button aria-pressed={decision === value} className={decision === value ? 'selected' : ''} key={value} onClick={() => onDecision(value)} type="button">{DECISION_LABELS[value]}</button>
        ))}
      </fieldset>

      <div className={canApply ? 'apply-status safe' : 'apply-status blocked'}>
        <strong>{canApply ? '可以安全定位' : '不能自动应用'}</strong><span>{anchor.message}</span>
      </div>
      <button className="primary-button full-button" disabled={!canApply} onClick={onApply} type="button">
        {anchor.state === 'already-applied' ? '已应用到作者工作稿' : '应用这一条建议'}
      </button>
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
  const [textView, setTextView] = useState<TextView>('author');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>('all');
  const [selectedId, setSelectedId] = useState(result?.issues[0]?.id || '');
  const [message, setMessage] = useState('');

  const filteredIssues = useMemo(() => (result?.issues || []).filter((issue) => {
    const decision = workspace.decisions[issue.id] || 'pending';
    return (severityFilter === 'all' || issue.severity === severityFilter)
      && (decisionFilter === 'all' || decision === decisionFilter);
  }), [decisionFilter, result?.issues, severityFilter, workspace.decisions]);
  const selectedIssue = filteredIssues.find((issue) => issue.id === selectedId) || filteredIssues[0] || null;
  const processed = (result?.issues || []).filter((issue) => (workspace.decisions[issue.id] || 'pending') !== 'pending').length;
  const pending = (result?.issues.length || 0) - processed;

  if (!result) return null;

  function setDecision(issueId: string, decision: IssueDecision) {
    onUpdate({ ...workspace, decisions: { ...workspace.decisions, [issueId]: decision } });
    setMessage(`已记录作者决定：${DECISION_LABELS[decision]}。`);
  }

  function applyIssue(issue: ReviewIssue) {
    try {
      onUpdate(applyIssueToWorkspace(workspace, issue));
      setTextView('author');
      setMessage('已把这一条建议应用到作者工作稿。可使用撤销恢复。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '建议无法安全应用。');
    }
  }

  const displayedText = textView === 'original' ? workspace.draft.sourceText : textView === 'suggested' ? result.suggestedText : workspace.workingText;

  return (
    <div className="review-page">
      <div className="review-header">
        <div>
          <span className="eyebrow">审校工作台 · 第 2 步，共 2 步</span>
          <h1>{workspace.draft.projectName || '未命名任务'}</h1>
          <p>{TASK_LABELS[workspace.draft.taskType]} · {SECTION_LABELS[workspace.draft.sectionType]}{workspace.draft.targetJournal ? ` · ${workspace.draft.targetJournal}` : ''}</p>
        </div>
        <div className="review-actions">
          <button disabled={!workspace.undoStack.length} onClick={() => onUpdate(undoWorkspace(workspace))} type="button">撤销</button>
          <button disabled={!workspace.redoStack.length} onClick={() => onUpdate(redoWorkspace(workspace))} type="button">重做</button>
          <button onClick={onStartNew} type="button">开始新任务</button>
        </div>
      </div>

      <StatusBanner tone="warning" title="这是 AI 建议，不是最终科研结论">
        数值与术语已通过确定性检查，但作者仍须核对事实、引用、统计结果、方法描述、因果边界和期刊要求。
      </StatusBanner>
      {message ? <p className="live-message" role="status">{message}</p> : null}

      <section className="review-summary" aria-labelledby="summary-title">
        <div><span className="eyebrow">分析摘要</span><h2 id="summary-title">{result.summary}</h2></div>
        <dl>
          <div><dt>问题</dt><dd>{result.issues.length}</dd></div>
          <div><dt>已处理</dt><dd>{processed}</dd></div>
          <div><dt>待处理</dt><dd>{pending}</dd></div>
          <div><dt>已应用</dt><dd>{workspace.appliedEdits.length}</dd></div>
        </dl>
      </section>

      <div className="workbench-grid">
        <section className="document-panel" aria-labelledby="document-title">
          <div className="document-toolbar">
            <div><span className="eyebrow">文档视图</span><h2 id="document-title">{textView === 'author' ? '作者工作稿' : textView === 'suggested' ? 'AI 建议稿' : '原始文本'}</h2></div>
            <div className="segmented-control" role="tablist" aria-label="文本版本">
              <button aria-selected={textView === 'author'} onClick={() => setTextView('author')} role="tab" type="button">作者工作稿</button>
              <button aria-selected={textView === 'suggested'} onClick={() => setTextView('suggested')} role="tab" type="button">AI 建议稿</button>
              <button aria-selected={textView === 'original'} onClick={() => setTextView('original')} role="tab" type="button">原文</button>
            </div>
          </div>
          <div className="version-explanation">
            {textView === 'author' ? '只包含作者逐条应用的安全修改，可撤销、重做和导出。' : textView === 'suggested' ? '模型生成的完整建议稿，仅供对照，不会自动覆盖作者工作稿。' : '分析时提交的只读原始文本，始终保留。'}
          </div>
          <pre className="manuscript-text" tabIndex={0}>{displayedText}</pre>
        </section>

        <aside className="issues-panel" aria-label="问题列表与详情">
          <div className="issue-filters">
            <label><span>风险级别</span><select onChange={(event) => setSeverityFilter(event.target.value as SeverityFilter)} value={severityFilter}><option value="all">全部</option><option value="major">重大</option><option value="minor">一般</option><option value="suggestion">建议</option></select></label>
            <label><span>作者决定</span><select onChange={(event) => setDecisionFilter(event.target.value as DecisionFilter)} value={decisionFilter}><option value="all">全部</option><option value="pending">待处理</option><option value="accepted">接受</option><option value="rejected">拒绝</option><option value="deferred">待定</option></select></label>
          </div>
          {filteredIssues.length ? (
            <>
              <div className="issue-list" role="list" aria-label="审校问题">
                {filteredIssues.map((issue, index) => {
                  const decision = workspace.decisions[issue.id] || 'pending';
                  return (
                    <button aria-current={selectedIssue?.id === issue.id} key={issue.id} onClick={() => setSelectedId(issue.id)} role="listitem" type="button">
                      <span className={`severity severity-${issue.severity}`}>{SEVERITY_LABELS[issue.severity]}</span>
                      <span><b>{index + 1}. {issue.category}</b><small>{issue.location} · {DECISION_LABELS[decision]}</small></span>
                    </button>
                  );
                })}
              </div>
              {selectedIssue ? <IssueDetail decision={workspace.decisions[selectedIssue.id] || 'pending'} issue={selectedIssue} onApply={() => applyIssue(selectedIssue)} onDecision={(decision) => setDecision(selectedIssue.id, decision)} workspace={workspace} /> : null}
            </>
          ) : <div className="empty-state"><strong>{result.issues.length ? '当前筛选下没有问题' : '没有发现需要逐条处理的问题'}</strong><p>{result.issues.length ? '调整筛选条件查看其他问题。' : '这不等于全文不存在科研风险，请继续进行作者核对。'}</p></div>}
        </aside>
      </div>

      <section className="export-panel" aria-labelledby="export-title">
        <div><span className="eyebrow">导出前复核</span><h2 id="export-title">保留作者决定和可恢复工作区</h2><p>{pending ? `仍有 ${pending} 条问题待处理。可以导出，但应在提交或发表前逐条核对。` : '所有问题都已有作者决定。仍需进行最终事实、引用和版式核对。'}</p></div>
        <div className="export-actions">
          <button onClick={() => exportWorkingText(workspace)} type="button">作者工作稿 TXT</button>
          <button onClick={() => exportReviewReport(workspace)} type="button">审校报告 Markdown</button>
          <button onClick={() => void exportCleanDocx(workspace)} type="button">清洁 DOCX</button>
        </div>
      </section>
    </div>
  );
}
