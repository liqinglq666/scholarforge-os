'use client';

import { useMemo, useState } from 'react';

type Segment = {
  text: string;
  emphasis?: 'risk' | 'safe';
};

type JudgeCase = {
  id: string;
  passportId: string;
  title: string;
  description: string;
  original: Segment[];
  candidate: Segment[];
  changeType: string;
  result: 'blocked' | 'passed';
  resultLabel: string;
  rule: string;
  evidence: string;
  status: 'quarantined' | 'review_ready';
  automaticApply: string;
  trace: Array<{
    label: string;
    detail: string;
    state: 'done' | 'blocked' | 'waiting';
  }>;
};

const cases: JudgeCase[] = [
  {
    id: 'number',
    passportId: 'VEP-001',
    title: '数字被 AI 偷偷改了',
    description: '候选文本只改了一个数字，但这个变化足以改变科研事实。',
    original: [
      { text: 'The compressive strength increased from 42.6 MPa to ' },
      { text: '48.3 MPa', emphasis: 'safe' },
      { text: '.' },
    ],
    candidate: [
      { text: 'The compressive strength increased from 42.6 MPa to ' },
      { text: '58.3 MPa', emphasis: 'risk' },
      { text: '.' },
    ],
    changeType: '数值修改',
    result: 'blocked',
    resultLabel: 'BLOCKED',
    rule: 'Numerical invariant',
    evidence: '48.3 MPa ≠ 58.3 MPa',
    status: 'quarantined',
    automaticApply: '禁止',
    trace: [
      { label: 'AI Candidate', detail: '候选修改已生成', state: 'done' },
      { label: 'Response Validator', detail: '结构完整，可进入规则检查', state: 'done' },
      { label: 'Safety Gate', detail: '检测到受保护数值变化', state: 'blocked' },
      { label: 'Author Decision', detail: '危险候选已隔离，无自动应用入口', state: 'waiting' },
    ],
  },
  {
    id: 'causal',
    passportId: 'VEP-002',
    title: '相关性被升级成因果',
    description: '语言看起来更有力，但证据边界已经发生变化。',
    original: [
      { text: 'Sleep duration was ' },
      { text: 'associated with', emphasis: 'safe' },
      { text: ' anxiety symptoms.' },
    ],
    candidate: [
      { text: 'Sleep duration ' },
      { text: 'caused', emphasis: 'risk' },
      { text: ' anxiety symptoms.' },
    ],
    changeType: '因果关系升级',
    result: 'blocked',
    resultLabel: 'BLOCKED',
    rule: 'Causal overclaim',
    evidence: 'associated with → caused',
    status: 'quarantined',
    automaticApply: '禁止',
    trace: [
      { label: 'AI Candidate', detail: '候选修改已生成', state: 'done' },
      { label: 'Response Validator', detail: '结构完整，可进入规则检查', state: 'done' },
      { label: 'Safety Gate', detail: '相关关系被升级为因果关系', state: 'blocked' },
      { label: 'Author Decision', detail: '保留原文并展示阻断证据', state: 'waiting' },
    ],
  },
  {
    id: 'language',
    passportId: 'VEP-003',
    title: '安全的语言润色',
    description: '表达得到改善，同时保持事实、范围与结论强度不变。',
    original: [
      { text: 'The results ' },
      { text: 'indicate', emphasis: 'safe' },
      { text: ' that the intervention may improve recovery.' },
    ],
    candidate: [
      { text: 'These findings ' },
      { text: 'suggest', emphasis: 'safe' },
      { text: ' that the intervention may improve recovery.' },
    ],
    changeType: '语言表达优化',
    result: 'passed',
    resultLabel: 'PASSED',
    rule: 'Protected facts unchanged',
    evidence: '数值、引用、研究范围与结论强度均未改变',
    status: 'review_ready',
    automaticApply: '仍需作者授权',
    trace: [
      { label: 'AI Candidate', detail: '候选修改已生成', state: 'done' },
      { label: 'Response Validator', detail: '结构完整，可进入规则检查', state: 'done' },
      { label: 'Safety Gate', detail: '当前硬规则未发现越界', state: 'done' },
      { label: 'Author Decision', detail: '等待作者接受、拒绝或暂缓', state: 'waiting' },
    ],
  },
];

function RenderSegments({ segments }: { segments: Segment[] }) {
  return (
    <>
      {segments.map((segment, index) => {
        if (!segment.emphasis) return <span key={`${segment.text}-${index}`}>{segment.text}</span>;
        return (
          <mark className={`judge-mark judge-mark-${segment.emphasis}`} key={`${segment.text}-${index}`}>
            {segment.text}
          </mark>
        );
      })}
    </>
  );
}

export function JudgeExperience() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [decisions, setDecisions] = useState<Record<string, '接受' | '拒绝' | '暂缓'>>({});

  const activeCase = cases[activeIndex];
  const activeRevealed = Boolean(revealed[activeCase.id]);
  const completedCount = useMemo(() => Object.keys(revealed).length, [revealed]);
  const benchmarkComplete = completedCount === cases.length;

  const revealCurrent = () => {
    setRevealed((current) => ({ ...current, [activeCase.id]: true }));
  };

  const goToCase = (index: number) => {
    setActiveIndex(index);
  };

  const goNext = () => {
    setActiveIndex((current) => Math.min(current + 1, cases.length - 1));
  };

  const resetExperience = () => {
    setActiveIndex(0);
    setRevealed({});
    setDecisions({});
  };

  return (
    <section aria-labelledby="judge-experience-title" className="judge-experience-section" id="judge-experience">
      <div className="shell">
        <div className="judge-section-heading">
          <div>
            <span className="product-label">90 秒评审体验</span>
            <h2 id="judge-experience-title">三个案例，看清 Safety Gate 到底做了什么</h2>
          </div>
          <p>
            这里使用固定的公开合成文本和确定性预设结果，只用于解释安全机制；不会调用模型，也不会写入真实工作区。
          </p>
        </div>

        <div className="judge-progress" aria-label={`已查看 ${completedCount} / ${cases.length} 个案例`}>
          <div><span>评审进度</span><strong>{completedCount} / {cases.length}</strong></div>
          <div className="judge-progress-track" aria-hidden="true"><span style={{ width: `${(completedCount / cases.length) * 100}%` }} /></div>
        </div>

        <div className="judge-case-tabs" role="group" aria-label="选择评审案例">
          {cases.map((item, index) => (
            <button
              aria-pressed={activeIndex === index}
              className={activeIndex === index ? 'judge-case-tab active' : 'judge-case-tab'}
              key={item.id}
              onClick={() => goToCase(index)}
              type="button"
            >
              <span>Case {index + 1}</span>
              <strong>{item.title}</strong>
              {revealed[item.id] ? <small>{item.resultLabel}</small> : <small>未运行</small>}
            </button>
          ))}
        </div>

        <div className="judge-case-layout">
          <article className="judge-case-card">
            <header>
              <div>
                <span>Case {activeIndex + 1}</span>
                <h3>{activeCase.title}</h3>
                <p>{activeCase.description}</p>
              </div>
              <span className="judge-passport-id">{activeCase.passportId}</span>
            </header>

            <div className="judge-text-compare">
              <section>
                <span>作者原文</span>
                <p><RenderSegments segments={activeCase.original} /></p>
              </section>
              <section className="candidate">
                <span>AI 候选</span>
                <p><RenderSegments segments={activeCase.candidate} /></p>
              </section>
            </div>

            {!activeRevealed ? (
              <div className="judge-run-panel">
                <p>现在让独立 Safety Gate 检查这一次 AI 修改，而不是相信模型自己声明“安全”。</p>
                <button className="primary-button" onClick={revealCurrent} type="button">运行 Safety Gate</button>
              </div>
            ) : (
              <div aria-live="polite" className={`judge-result-banner judge-result-${activeCase.result}`}>
                <span>{activeCase.result === 'blocked' ? '✕' : '✓'}</span>
                <div>
                  <strong>{activeCase.resultLabel}</strong>
                  <p>{activeCase.result === 'blocked' ? '候选修改已进入 quarantined，作者工作稿保持不变。' : '通过当前硬规则，但仍然不能绕过作者确认。'}</p>
                </div>
              </div>
            )}
          </article>

          <aside className="judge-passport-card" aria-label="Verified Edit Passport 科研修改通行证">
            <header>
              <div><span>Verified Edit Passport</span><strong>科研修改通行证</strong></div>
              <b className={activeRevealed ? `passport-result passport-${activeCase.result}` : 'passport-result'}>
                {activeRevealed ? activeCase.resultLabel : 'WAITING'}
              </b>
            </header>

            <dl>
              <div><dt>通行证编号</dt><dd>{activeCase.passportId}</dd></div>
              <div><dt>修改类型</dt><dd>{activeCase.changeType}</dd></div>
              <div><dt>Safety Gate</dt><dd>{activeRevealed ? activeCase.resultLabel : '等待检查'}</dd></div>
              <div><dt>规则</dt><dd>{activeRevealed ? activeCase.rule : '—'}</dd></div>
              <div><dt>证据</dt><dd>{activeRevealed ? activeCase.evidence : '运行后显示'}</dd></div>
              <div><dt>状态</dt><dd>{activeRevealed ? activeCase.status : 'pending'}</dd></div>
              <div><dt>自动应用</dt><dd>{activeRevealed ? activeCase.automaticApply : '未授权'}</dd></div>
              <div><dt>最终控制者</dt><dd>作者</dd></div>
            </dl>
          </aside>
        </div>

        {activeRevealed ? (
          <div className="judge-trace-panel">
            <div className="judge-trace-heading">
              <div><span className="product-label">可验证执行轨迹</span><h3>不是一个黑盒“安全分数”</h3></div>
              <p>生成、结构校验、规则检查和作者决定被拆成独立权限边界。</p>
            </div>
            <ol className="judge-trace-list">
              {activeCase.trace.map((step, index) => (
                <li className={`trace-${step.state}`} key={step.label}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div><strong>{step.label}</strong><p>{step.detail}</p></div>
                </li>
              ))}
            </ol>

            {activeCase.result === 'passed' ? (
              <div className="judge-author-decision">
                <div>
                  <span className="product-label">Author Decision</span>
                  <h3>通过 Safety Gate，也不等于自动写入论文</h3>
                  <p>最终文本仍然必须由作者接受、拒绝或暂缓。</p>
                </div>
                <div className="judge-decision-actions" role="group" aria-label="作者决定">
                  {(['接受', '拒绝', '暂缓'] as const).map((decision) => (
                    <button
                      aria-pressed={decisions[activeCase.id] === decision}
                      className={decisions[activeCase.id] === decision ? 'secondary-button selected' : 'secondary-button'}
                      key={decision}
                      onClick={() => setDecisions((current) => ({ ...current, [activeCase.id]: decision }))}
                      type="button"
                    >
                      {decision}
                    </button>
                  ))}
                </div>
                <p aria-live="polite" className="judge-decision-status">
                  {decisions[activeCase.id]
                    ? `作者已选择：${decisions[activeCase.id]}。这一步才决定候选修改是否进入后续工作稿流程。`
                    : '尚未作出作者决定。'}
                </p>
              </div>
            ) : null}

            {activeIndex < cases.length - 1 ? (
              <div className="judge-next-case">
                <button className="primary-button" onClick={goNext} type="button">下一个案例 →</button>
              </div>
            ) : null}
          </div>
        ) : null}

        {benchmarkComplete ? (
          <section aria-labelledby="judge-benchmark-title" className="judge-trace-panel">
            <div className="judge-trace-heading">
              <div>
                <span className="product-label">Safety Benchmark · Public Challenge Set</span>
                <h3 id="judge-benchmark-title">三次修改，三次留下可核对的权限结论</h3>
              </div>
              <p>
                这是本页三个固定合成案例的确定性汇总，不是模型准确率，也不代表对所有科研风险的覆盖率。
              </p>
            </div>
            <ol className="judge-trace-list" aria-label="评审体验汇总">
              <li className="trace-blocked">
                <span>02</span>
                <div><strong>危险修改被隔离</strong><p>数值篡改与因果越界均进入 quarantined。</p></div>
              </li>
              <li>
                <span>01</span>
                <div><strong>安全候选进入作者审阅</strong><p>PASSED 只开放审阅权限，不授予自动写入权限。</p></div>
              </li>
              <li>
                <span>00</span>
                <div><strong>自动写入论文</strong><p>三个案例都没有绕过作者确认直接修改工作稿。</p></div>
              </li>
              <li className="trace-waiting">
                <span>YOU</span>
                <div><strong>Attack the Gate</strong><p>重置案例，再从评委视角尝试判断哪一次修改应该被拦截。</p></div>
              </li>
            </ol>
            <div className="judge-next-case">
              <button className="secondary-button" onClick={resetExperience} type="button">重置并再次挑战 Safety Gate</button>
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}
