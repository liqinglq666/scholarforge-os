'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { StatusBanner } from '@/components/feedback/status-banner';
import { useWorkspace } from '@/components/workspace/use-workspace';
import { SECTION_OPTIONS, TASK_LABELS } from '@/lib/config';
import type {
  AcademicStage,
  AuthStatus,
  ChapterTemplateItem,
  EnglishVariant,
  ExplanationLevel,
  SectionType,
  TaskType,
  UserPreferences,
} from '@/lib/types';
import { createUserPreferences, parseUserPreferences } from '@/lib/workspace/schema';

const TASKS = Object.keys(TASK_LABELS) as TaskType[];
const STAGES: Array<[AcademicStage, string]> = [
  ['masters', '硕士研究生'],
  ['doctoral', '博士研究生'],
  ['postgraduate', '其他研究生阶段'],
  ['researcher', '科研人员或博士后'],
  ['other', '其他'],
];
const EXPLANATIONS: Array<[ExplanationLevel, string]> = [
  ['brief', '简洁：优先给结论和必要理由'],
  ['balanced', '平衡：解释问题、风险和修改理由'],
  ['detailed', '详细：提供更多语言与科研表达说明'],
];

function clonePreferences(value: UserPreferences): UserPreferences {
  return {
    ...value,
    customWritingRules: value.customWritingRules.map((item) => ({ ...item })),
    chapterTemplate: value.chapterTemplate.map((item) => ({ ...item })),
  };
}

export function PreferencesManager() {
  const { data, ready, saveState, saveMessage, replaceData, saveNow } = useWorkspace();
  const [draft, setDraft] = useState<UserPreferences>(() => createUserPreferences());
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [ruleSource, setRuleSource] = useState('');
  const [rulePreferred, setRulePreferred] = useState('');
  const [ruleNote, setRuleNote] = useState('');

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => setDraft(clonePreferences(data.preferences)), 0);
    return () => window.clearTimeout(timer);
  }, [data.preferences, ready]);

  useEffect(() => {
    fetch('/api/auth/session', { cache: 'no-store' })
      .then((response) => response.json() as Promise<AuthStatus>)
      .then(setAuth)
      .catch(() => setAuth({ configured: false, authenticated: false, user: null, message: '账户状态不可用。' }));
  }, []);

  function patch(patchValue: Partial<UserPreferences>) {
    setDraft((previous) => ({ ...previous, ...patchValue }));
    setMessage('');
    setError('');
  }

  function persistLocal(value = draft) {
    const preferences = parseUserPreferences({ ...value, updatedAt: new Date().toISOString() });
    const nextData = { ...data, preferences, updatedAt: new Date().toISOString() };
    replaceData(nextData);
    const saved = saveNow(nextData);
    setDraft(clonePreferences(preferences));
    if (saved) setMessage('个性化偏好已保存到此浏览器。现有任务和论文不会被自动改写。');
    return { preferences, saved };
  }

  function addRule() {
    const source = ruleSource.trim();
    const preferred = rulePreferred.trim();
    if (!source || !preferred || draft.customWritingRules.length >= 30) return;
    if (draft.customWritingRules.some((item) => item.source.toLocaleLowerCase() === source.toLocaleLowerCase())) {
      setError('这个原词已经存在于自定义规则中。');
      return;
    }
    patch({
      customWritingRules: [...draft.customWritingRules, {
        id: crypto.randomUUID(),
        source,
        preferred,
        ...(ruleNote.trim() ? { note: ruleNote.trim() } : {}),
      }],
    });
    setRuleSource('');
    setRulePreferred('');
    setRuleNote('');
  }

  function updateTemplate(id: string, value: Partial<ChapterTemplateItem>) {
    patch({ chapterTemplate: draft.chapterTemplate.map((item) => item.id === id ? { ...item, ...value } : item) });
  }

  function addTemplateItem() {
    if (draft.chapterTemplate.length >= 12) return;
    patch({
      chapterTemplate: [...draft.chapterTemplate, {
        id: crypto.randomUUID(),
        title: `章节 ${draft.chapterTemplate.length + 1}`,
        sectionType: 'general',
      }],
    });
  }

  function resetTemplate() {
    if (!window.confirm('恢复标准六章节模板？当前个性化模板会被替换，但已有论文项目不会改变。')) return;
    patch({ chapterTemplate: createUserPreferences().chapterTemplate });
  }

  async function uploadCloud() {
    const local = persistLocal();
    if (!local.saved) return;
    setSyncing(true);
    setError('');
    try {
      const response = await fetch('/api/preferences/cloud', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: local.preferences }),
      });
      const payload = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(payload.error || '云端同步失败。');
      setMessage(payload.message || '偏好已同步。');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '云端同步失败。');
    } finally {
      setSyncing(false);
    }
  }

  async function downloadCloud() {
    setSyncing(true);
    setError('');
    try {
      const response = await fetch('/api/preferences/cloud', { cache: 'no-store' });
      const payload = await response.json() as { preferences?: UserPreferences | null; error?: string };
      if (!response.ok) throw new Error(payload.error || '无法读取云端偏好。');
      if (!payload.preferences) {
        setMessage('账户中还没有云端偏好。请先保存并上传一次。');
        return;
      }
      if (!window.confirm('用云端偏好替换此浏览器中的个性化设置？现有论文和任务不会改变。')) return;
      const preferences = parseUserPreferences(payload.preferences);
      const nextData = { ...data, preferences, updatedAt: new Date().toISOString() };
      replaceData(nextData);
      saveNow(nextData);
      setDraft(clonePreferences(preferences));
      setMessage('已把云端偏好载入此浏览器。');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '无法读取云端偏好。');
    } finally {
      setSyncing(false);
    }
  }

  if (!ready) return <div className="loading-state" role="status"><span className="spinner" /><strong>正在读取个性化偏好</strong></div>;

  return (
    <div className="preferences-content">
      <div className={`save-indicator save-${saveState}`} aria-live="polite"><span aria-hidden="true" />{saveMessage}</div>
      <div className="page-heading">
        <div><span className="eyebrow">个性化 · 可复用但不越过安全边界</span><h1>让默认设置适合你的学科和写作习惯</h1></div>
        <p>偏好用于之后的新任务和新论文项目。不会自动重写已有正文，也不能覆盖数值、引用、证据边界等科研安全规则。</p>
      </div>
      {message ? <StatusBanner tone="success" title="偏好已更新">{message}</StatusBanner> : null}
      {error ? <StatusBanner tone="danger" title="偏好操作未完成">{error}</StatusBanner> : null}

      <section className="settings-section" aria-labelledby="profile-preferences-title">
        <div><span className="step-number">01</span><h2 id="profile-preferences-title">研究背景与表达偏好</h2></div>
        <div className="form-grid two-columns">
          <label><span>显示名称（可选）</span><input maxLength={80} onChange={(event) => patch({ displayName: event.target.value })} placeholder="用于账户和报告署名，不写入论文正文" value={draft.displayName} /></label>
          <label><span>学科或研究方向</span><input maxLength={100} onChange={(event) => patch({ discipline: event.target.value })} placeholder="例如：环境工程、教育心理、计算机视觉" value={draft.discipline} /></label>
          <label><span>当前阶段</span><select onChange={(event) => patch({ academicStage: event.target.value as AcademicStage })} value={draft.academicStage}>{STAGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>英文变体</span><select onChange={(event) => patch({ englishVariant: event.target.value as EnglishVariant })} value={draft.englishVariant}><option value="us">美式英语</option><option value="uk">英式英语</option></select></label>
          <label className="full-width"><span>解释详细度</span><select onChange={(event) => patch({ explanationLevel: event.target.value as ExplanationLevel })} value={draft.explanationLevel}>{EXPLANATIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="defaults-title">
        <div><span className="step-number">02</span><h2 id="defaults-title">新任务默认值</h2></div>
        <div className="form-grid two-columns">
          <label><span>默认审校任务</span><select onChange={(event) => patch({ defaultTaskType: event.target.value as TaskType })} value={draft.defaultTaskType}>{TASKS.map((task) => <option key={task} value={task}>{TASK_LABELS[task]}</option>)}</select></label>
          <label><span>默认章节类型</span><select onChange={(event) => patch({ defaultSectionType: event.target.value as SectionType })} value={draft.defaultSectionType}>{SECTION_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="full-width"><span>默认目标期刊或写作语境</span><input maxLength={160} onChange={(event) => patch({ defaultTargetJournal: event.target.value })} placeholder="例如：目标期刊名称，或简短说明其读者和风格" value={draft.defaultTargetJournal} /></label>
        </div>
        <p className="settings-help">这些值只在创建新任务时预填；从示例或论文项目打开章节时，仍以该任务和项目的明确设置为准。</p>
      </section>

      <section className="settings-section" aria-labelledby="rules-title">
        <div><span className="step-number">03</span><h2 id="rules-title">自定义术语与表达规则</h2></div>
        <p>适合保存实验材料名称、量表、算法、机构规定译法、非首选表达和缩写。规则会作为术语锁加入新任务，仍受最多 30 条限制。</p>
        <div className="custom-rule-entry">
          <label><span>原词或非首选表达</span><input maxLength={120} onChange={(event) => setRuleSource(event.target.value)} placeholder="例如：neural net" value={ruleSource} /></label>
          <label><span>指定表达</span><input maxLength={160} onChange={(event) => setRulePreferred(event.target.value)} placeholder="例如：neural network (NN)" value={rulePreferred} /></label>
          <label><span>说明（可选）</span><input maxLength={240} onChange={(event) => setRuleNote(event.target.value)} placeholder="例如：首次出现需给出缩写" value={ruleNote} /></label>
          <button disabled={!ruleSource.trim() || !rulePreferred.trim() || draft.customWritingRules.length >= 30} onClick={addRule} type="button">添加规则</button>
        </div>
        {draft.customWritingRules.length ? <ul className="custom-rule-list">{draft.customWritingRules.map((rule) => <li key={rule.id}><span><strong>{rule.source}</strong><b>→ {rule.preferred}</b>{rule.note ? <small>{rule.note}</small> : null}</span><button aria-label={`删除规则 ${rule.source}`} onClick={() => patch({ customWritingRules: draft.customWritingRules.filter((item) => item.id !== rule.id) })} type="button">删除</button></li>)}</ul> : <p className="empty-inline">尚未添加个人规则。项目仍可使用自己的术语库。</p>}
      </section>

      <section className="settings-section" aria-labelledby="template-title">
        <div className="preferences-section-heading"><div><span className="step-number">04</span><h2 id="template-title">新论文项目章节模板</h2></div><div><button onClick={resetTemplate} type="button">恢复标准模板</button><button disabled={draft.chapterTemplate.length >= 12} onClick={addTemplateItem} type="button">添加章节</button></div></div>
        <p>创建新论文项目时按此顺序生成章节。审校任务会在每次处理章节时选择，不再固化到章节模板。已有项目不会随模板变化。</p>
        <ol className="chapter-template-list">
          {draft.chapterTemplate.map((item, index) => (
            <li key={item.id}>
              <span>{index + 1}</span>
              <input aria-label={`模板章节 ${index + 1} 名称`} maxLength={120} onChange={(event) => updateTemplate(item.id, { title: event.target.value })} value={item.title} />
              <select aria-label={`模板章节 ${index + 1} 类型`} onChange={(event) => updateTemplate(item.id, { sectionType: event.target.value as SectionType })} value={item.sectionType}>{SECTION_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              <button disabled={draft.chapterTemplate.length <= 1} onClick={() => patch({ chapterTemplate: draft.chapterTemplate.filter((chapter) => chapter.id !== item.id) })} type="button">删除</button>
            </li>
          ))}
        </ol>
      </section>

      <section className="settings-section" aria-labelledby="sync-title">
        <div><span className="step-number">05</span><h2 id="sync-title">保存与账户同步</h2></div>
        <div className="preference-sync-grid">
          <article><strong>此浏览器</strong><p>保存全部个性化偏好，立即用于之后的新任务和项目。</p><button className="primary-button" onClick={() => persistLocal()} type="button">保存本地偏好</button></article>
          <article><strong>账户偏好</strong><p>{auth?.authenticated ? `已登录 ${auth.user?.email || ''}。只同步本页设置，不同步论文正文。` : auth?.configured ? '登录后可在设备之间同步本页偏好。' : '账户服务未配置，仍可正常使用本地偏好。'}</p>{auth?.authenticated ? <div><button disabled={syncing} onClick={() => void uploadCloud()} type="button">上传当前偏好</button><button disabled={syncing} onClick={() => void downloadCloud()} type="button">载入云端偏好</button></div> : <Link className="secondary-link" href="/account">{auth?.configured ? '前往登录' : '查看账户配置'}</Link>}</article>
        </div>
      </section>
    </div>
  );
}
