# ScholarForge OS v1.5 Evidence Desk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild ScholarForge OS as a mature evidence-first research workspace with a research project hub, a three-column manuscript/evidence/decision workbench, compatible storage and export behavior, final product screenshots, and synchronized README and Feishu documentation.

**Architecture:** Keep the existing Next.js/React application, review API, document ingestion, Supabase, IndexedDB, author-editing, and DOCX export engines. Introduce a shared version/storage contract, extract pure project and evidence view models, split the oversized hub and PaperLens components into focused feature components, replace versioned CSS overrides with semantic style layers, and expose existing utility workflows through one app shell instead of floating docks.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.8, Vitest, Supabase, Mammoth, PDF.js, docx.js, JSZip, Vercel, GitHub Actions.

## Global Constraints

- Target version is exactly `1.5.0` in package metadata, runtime UI, health API, README, and both Feishu documents.
- Preserve the storage keys `scholarforge-os-paperlens-draft-v1`, `scholarforge-os-paperlens-history-v1`, `scholarforge-os-hub-view-v1`, and `scholarforge-os-author-editing-session-v1`.
- Preserve existing localStorage, IndexedDB, Supabase Auth/RLS, original-DOCX binding, clean DOCX export, tracked-changes export, undo/redo, terminology locks, and guest fallback behavior.
- Keep all four workflows: `translate`, `polish`, `precheck`, and `review-response`.
- Keep all seven review sections and three review modes.
- Preserve the serialized decision values `pending`, `accepted`, `deferred`, and `dismissed`; only their user-facing labels change to “待处理、接受、保留待定、拒绝”.
- Do not add OCR; scanned PDFs must continue to show an explicit unsupported-state message.
- Do not expose API keys in browser code.
- Do not silently delete or overwrite incompatible local or cloud data.
- Do not add a new versioned CSS override file.
- README wording must be professional and neutral; do not add competition-judge copy or unverifiable claims.
- Final screenshots must come from the deployed v1.5 interface and public-safe demonstration data.

---

## Planned File Structure

### Shared contracts and tests

- Create `lib/app-config.ts`: one source of truth for version, storage keys, limits, and labels.
- Create `lib/workspace-schema.ts`: shared draft, snapshot, backup, and runtime guards.
- Create `lib/workspace-store.ts`: browser storage adapter with non-destructive reads and backup parsing.
- Create `lib/evidence-model.ts`: evidence view model, decision labels, risk rules, and batch-apply eligibility.
- Create `tests/app-config.test.ts`.
- Create `tests/workspace-store.test.ts`.
- Create `tests/evidence-model.test.ts`.
- Create `vitest.config.ts`.

### UI shell and primitives

- Create `components/ui/icon.tsx`.
- Create `components/ui/status-badge.tsx`.
- Create `components/ui/empty-state.tsx`.
- Create `components/app-shell.tsx`.
- Create `components/app-tools.tsx`.

### Project center

- Create `components/project-hub/project-hub.tsx`.
- Create `components/project-hub/project-table.tsx`.
- Create `components/project-hub/new-project-panel.tsx`.
- Create `components/project-hub/project-hub-model.ts`.
- Create `tests/project-hub-model.test.ts`.

### Evidence workbench

- Create `components/workbench/workbench-shell.tsx`.
- Create `components/workbench/use-workbench-controller.ts`.
- Create `components/workbench/document-outline.tsx`.
- Create `components/workbench/manuscript-canvas.tsx`.
- Create `components/workbench/evidence-inspector.tsx`.
- Create `components/workbench/author-decision-bar.tsx`.
- Create `components/workbench/workflow-setup-panel.tsx`.
- Create `components/workbench/workbench-status.tsx`.

### Context panels

- Create `components/panels/account-panel.tsx`.
- Create `components/panels/cloud-workspace-panel.tsx`.
- Create `components/panels/document-import-panel.tsx`.
- Create `components/panels/history-panel.tsx`.
- Create `components/panels/author-editing-panel.tsx`.
- Create `components/panels/original-docx-patch-panel.tsx`.
- Create `components/panels/export-panel.tsx`.

### Semantic styles

- Create `app/styles/tokens.css`.
- Create `app/styles/base.css`.
- Create `app/styles/auth.css`.
- Create `app/styles/project-hub.css`.
- Create `app/styles/workbench.css`.
- Create `app/styles/panels.css`.
- Create `app/styles/responsive.css`.

### Documentation assets

- Create `docs/readme-assets/screenshots/01-login.png`.
- Create `docs/readme-assets/screenshots/02-project-hub.png`.
- Create `docs/readme-assets/screenshots/03-document-import.png`.
- Create `docs/readme-assets/screenshots/04-evidence-workbench.png`.
- Create `docs/readme-assets/screenshots/05-author-decision.png`.
- Create `docs/readme-assets/screenshots/06-history-export.png`.

---

### Task 1: Establish the v1.5 shared contract and test harness

**Files:**
- Create: `lib/app-config.ts`
- Create: `lib/workspace-schema.ts`
- Create: `lib/workspace-store.ts`
- Create: `tests/app-config.test.ts`
- Create: `tests/workspace-store.test.ts`
- Create: `vitest.config.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: `APP_VERSION`, `STORAGE_KEYS`, `WORKFLOW_LABELS`, `SECTION_LABELS`, `DECISION_LABELS`.
- Produces: `WorkspaceDraft`, `ReviewSnapshot`, `WorkspaceBackup`, `WorkspaceState`.
- Produces: `readWorkspaceState(storage)`, `writeWorkspaceDraft(storage, draft)`, `writeWorkspaceHistory(storage, history)`, `parseWorkspaceBackup(value)`.
- Consumes: `IssueDecision`, `ReviewMode`, `ReviewResult`, `ReviewSection`, `TerminologyLock`, `WorkspaceTask` from `lib/types.ts`.

- [ ] **Step 1: Install and configure Vitest**

Run:

```bash
npm install --save-dev vitest
```

Add scripts to `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
});
```

- [ ] **Step 2: Write failing version and storage-key tests**

Create `tests/app-config.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { APP_VERSION, DECISION_LABELS, STORAGE_KEYS } from '@/lib/app-config';

describe('app configuration', () => {
  it('uses one v1.5 version and preserves browser storage keys', () => {
    expect(APP_VERSION).toBe('1.5.0');
    expect(STORAGE_KEYS.draft).toBe('scholarforge-os-paperlens-draft-v1');
    expect(STORAGE_KEYS.history).toBe('scholarforge-os-paperlens-history-v1');
    expect(STORAGE_KEYS.hubView).toBe('scholarforge-os-hub-view-v1');
    expect(STORAGE_KEYS.authorEditingSession).toBe('scholarforge-os-author-editing-session-v1');
  });

  it('presents compatible decision values with author-facing labels', () => {
    expect(DECISION_LABELS).toEqual({
      pending: '待处理',
      accepted: '接受',
      deferred: '保留待定',
      dismissed: '拒绝',
    });
  });
});
```

- [ ] **Step 3: Write failing non-destructive workspace tests**

Create `tests/workspace-store.test.ts` with an in-memory `Storage` substitute and these cases:

```ts
import { describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '@/lib/app-config';
import { parseWorkspaceBackup, readWorkspaceState } from '@/lib/workspace-store';

function memoryStorage(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe('workspace store', () => {
  it('keeps valid v1 draft and history data readable', () => {
    const draft = { projectTitle: 'ECC paper', taskType: 'precheck', sourceText: 'A valid manuscript paragraph.', savedAt: '2026-07-31T00:00:00.000Z' };
    const storage = memoryStorage({
      [STORAGE_KEYS.draft]: JSON.stringify(draft),
      [STORAGE_KEYS.history]: '[]',
    });
    expect(readWorkspaceState(storage).draft?.projectTitle).toBe('ECC paper');
  });

  it('returns a recoverable warning without deleting malformed data', () => {
    const storage = memoryStorage({ [STORAGE_KEYS.history]: '{broken-json' });
    const state = readWorkspaceState(storage);
    expect(state.history).toEqual([]);
    expect(state.warnings).toContain('任务历史无法解析，原始浏览器数据已保留。');
    expect(storage.getItem(STORAGE_KEYS.history)).toBe('{broken-json');
  });

  it('rejects unsupported backup formats', () => {
    expect(() => parseWorkspaceBackup({ format: 'other', version: 1, history: [] }))
      .toThrow('这不是受支持的 ScholarForge 工作区备份。');
  });
});
```

- [ ] **Step 4: Run tests and verify failure**

Run:

```bash
npm run test -- tests/app-config.test.ts tests/workspace-store.test.ts
```

Expected: FAIL because the shared modules do not exist.

- [ ] **Step 5: Implement the shared contract**

Create `lib/app-config.ts`:

```ts
import type { IssueDecision, ReviewSection, WorkspaceTask } from '@/lib/types';

export const APP_VERSION = '1.5.0';
export const MAX_HISTORY = 8;

export const STORAGE_KEYS = {
  draft: 'scholarforge-os-paperlens-draft-v1',
  history: 'scholarforge-os-paperlens-history-v1',
  hubView: 'scholarforge-os-hub-view-v1',
  authorEditingSession: 'scholarforge-os-author-editing-session-v1',
  lastImport: 'scholarforge-os-document-import-v1',
} as const;

export const WORKFLOW_LABELS: Record<WorkspaceTask, string> = {
  translate: '科研中译英',
  polish: '英文保守润色',
  precheck: '投稿前预检',
  'review-response': '审稿回复助手',
};

export const SECTION_LABELS: Record<ReviewSection, string> = {
  general: '通用段落',
  abstract: '摘要',
  introduction: '引言',
  methods: '方法',
  results: '结果',
  discussion: '讨论',
  conclusion: '结论',
};

export const DECISION_LABELS: Record<IssueDecision, string> = {
  pending: '待处理',
  accepted: '接受',
  deferred: '保留待定',
  dismissed: '拒绝',
};
```

Move the duplicated draft/snapshot/backup interfaces into `lib/workspace-schema.ts`. Implement runtime guards that accept existing v1 records and retain unknown optional fields such as `importedDocument`, `authorEditing`, `workingText`, and `appliedEdits`.

Implement `lib/workspace-store.ts` without calling `removeItem` during reads. A malformed value returns an empty in-memory fallback plus a Chinese warning while preserving the raw browser value.

- [ ] **Step 6: Add tests to CI and run the complete gate**

Insert after dependency audit in `.github/workflows/ci.yml`:

```yaml
      - name: Unit tests
        run: npm run test
```

Run:

```bash
npm run test
npm run typecheck
npm run build
```

Expected: all commands exit `0`.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts .github/workflows/ci.yml lib/app-config.ts lib/workspace-schema.ts lib/workspace-store.ts tests/app-config.test.ts tests/workspace-store.test.ts
git commit -m "test: add v1.5 workspace contracts"
```

---

### Task 2: Define the evidence and author-decision model

**Files:**
- Create: `lib/evidence-model.ts`
- Create: `tests/evidence-model.test.ts`
- Modify: `lib/author-editing.ts`
- Modify: `lib/types.ts`

**Interfaces:**
- Consumes: `ReviewIssue`, `ReviewResult`, `IssueDecision`, `AppliedEdit`, `analyseIssueAnchor`.
- Produces: `EvidenceItem`, `EvidenceRisk`, `createEvidenceItems(result, decisions, applied)`.
- Produces: `requiresIndividualDecision(issue)`.
- Produces: `canBatchApplyIssue(source, issue, applied)`.

- [ ] **Step 1: Write failing evidence-model tests**

Create `tests/evidence-model.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { canBatchApplyIssue, createEvidenceItems, requiresIndividualDecision } from '@/lib/evidence-model';
import type { ReviewIssue, ReviewResult } from '@/lib/types';

const languageIssue: ReviewIssue = {
  id: 'language-1',
  agent: 'language',
  severity: 'minor',
  location: 'Methods paragraph 1',
  original: 'The tests was conducted.',
  revised: 'The tests were conducted.',
  reason: 'Subject–verb agreement.',
  category: 'Grammar',
  meaningChanged: false,
};

describe('evidence model', () => {
  it('keeps stored decision values while exposing author-facing labels', () => {
    const result = { issues: [languageIssue] } as ReviewResult;
    const [item] = createEvidenceItems(result, { 'language-1': 'dismissed' }, []);
    expect(item.decision).toBe('dismissed');
    expect(item.decisionLabel).toBe('拒绝');
  });

  it('requires individual decisions for major, meaning-changing, terminology, numeric, conclusion, and citation issues', () => {
    expect(requiresIndividualDecision({ ...languageIssue, severity: 'major' })).toBe(true);
    expect(requiresIndividualDecision({ ...languageIssue, category: 'Terminology' })).toBe(true);
    expect(requiresIndividualDecision({ ...languageIssue, category: 'Numerical value' })).toBe(true);
    expect(requiresIndividualDecision({ ...languageIssue, category: 'Citation' })).toBe(true);
  });

  it('allows batch application only for a low-risk uniquely anchored language issue', () => {
    expect(canBatchApplyIssue('The tests was conducted.', languageIssue, [])).toBe(true);
    expect(canBatchApplyIssue('The tests was conducted. The tests was conducted.', languageIssue, [])).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and verify failure**

Run:

```bash
npm run test -- tests/evidence-model.test.ts
```

Expected: FAIL because `lib/evidence-model.ts` does not exist.

- [ ] **Step 3: Implement exact risk and decision rules**

Create `lib/evidence-model.ts` with:

```ts
import { DECISION_LABELS } from '@/lib/app-config';
import { analyseIssueAnchor, type AppliedEdit } from '@/lib/author-editing';
import type { IssueDecision, ReviewIssue, ReviewResult } from '@/lib/types';

export type EvidenceRisk = 'high' | 'medium' | 'low';

export interface EvidenceItem {
  issue: ReviewIssue;
  decision: IssueDecision;
  decisionLabel: string;
  risk: EvidenceRisk;
  applied: boolean;
  requiresIndividualDecision: boolean;
}

const INDIVIDUAL_PATTERN = /(terminology|term|number|numerical|value|conclusion|citation|reference|术语|数值|结论|引用|参考文献)/i;

export function requiresIndividualDecision(issue: ReviewIssue) {
  return issue.severity === 'major'
    || issue.meaningChanged
    || issue.agent === 'logic'
    || issue.agent === 'method'
    || INDIVIDUAL_PATTERN.test(`${issue.category} ${issue.reason}`);
}

export function canBatchApplyIssue(source: string, issue: ReviewIssue, applied: AppliedEdit[]) {
  if (requiresIndividualDecision(issue)) return false;
  const anchor = analyseIssueAnchor(source, issue, applied);
  return anchor.state === 'safe-exact' || anchor.state === 'safe-whitespace';
}

export function createEvidenceItems(
  result: ReviewResult,
  decisions: Record<string, IssueDecision>,
  applied: AppliedEdit[],
): EvidenceItem[] {
  return result.issues.map((issue) => {
    const decision = decisions[issue.id] || 'pending';
    return {
      issue,
      decision,
      decisionLabel: DECISION_LABELS[decision],
      risk: issue.severity === 'major' || issue.meaningChanged
        ? 'high'
        : issue.severity === 'minor'
          ? 'medium'
          : 'low',
      applied: applied.some((edit) => edit.issueId === issue.id),
      requiresIndividualDecision: requiresIndividualDecision(issue),
    };
  });
}
```

Do not change the serialized union in `lib/types.ts`. Add only explanatory comments or reusable exported aliases if needed.

- [ ] **Step 4: Make bulk author editing use the stricter rule**

In `lib/author-editing.ts`, keep exact/whitespace anchoring unchanged. In the future controller, call `canBatchApplyIssue`; do not weaken `analyseIssueAnchor`, because single-item manual confirmation still depends on it.

Run:

```bash
npm run test -- tests/evidence-model.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/evidence-model.ts lib/author-editing.ts lib/types.ts tests/evidence-model.test.ts
git commit -m "feat: define evidence decision rules"
```

---

### Task 3: Replace versioned CSS with semantic design layers and shared primitives

**Files:**
- Create: `components/ui/icon.tsx`
- Create: `components/ui/status-badge.tsx`
- Create: `components/ui/empty-state.tsx`
- Create: `components/app-shell.tsx`
- Create: `app/styles/tokens.css`
- Create: `app/styles/base.css`
- Create: `app/styles/auth.css`
- Create: `app/styles/project-hub.css`
- Create: `app/styles/workbench.css`
- Create: `app/styles/panels.css`
- Create: `app/styles/responsive.css`
- Create: `tests/style-architecture.test.ts`
- Modify: `app/layout.tsx`

**Interfaces:**
- Produces: `<Icon name size />`, `<StatusBadge tone label />`, `<EmptyState title description action />`.
- Produces: `<AppShell title subtitle saveState version actions tools children />` with a stable top-bar and content slot.
- Produces CSS custom properties prefixed `--sf-`.
- Consumes no feature state.

- [ ] **Step 1: Write a failing CSS architecture test**

Create `tests/style-architecture.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('semantic style architecture', () => {
  it('imports semantic layers and no versioned override sheets', () => {
    const layout = readFileSync('app/layout.tsx', 'utf8');
    expect(layout).toContain("./styles/tokens.css");
    expect(layout).toContain("./styles/workbench.css");
    expect(layout).not.toMatch(/\.\/v\d+/);
    expect(layout).not.toContain("./product-ui.css");
  });

  it('defines readable body and control tokens', () => {
    const tokens = readFileSync('app/styles/tokens.css', 'utf8');
    expect(tokens).toContain('--sf-text-base: 1rem');
    expect(tokens).toContain('--sf-control-height: 2.75rem');
    expect(tokens).toContain('--sf-color-ink: #17233d');
  });
});
```

- [ ] **Step 2: Run the test and verify failure**

```bash
npm run test -- tests/style-architecture.test.ts
```

Expected: FAIL because the semantic files and imports do not exist.

- [ ] **Step 3: Implement tokens and primitives**

Start `app/styles/tokens.css` with exact baseline values:

```css
:root {
  --sf-color-paper: #fbfaf7;
  --sf-color-surface: #ffffff;
  --sf-color-canvas: #f2f4f6;
  --sf-color-ink: #17233d;
  --sf-color-muted: #5f6b7a;
  --sf-color-border: #d9dee5;
  --sf-color-primary: #2457a7;
  --sf-color-evidence: #28786f;
  --sf-color-warning: #a46616;
  --sf-color-danger: #a84646;
  --sf-text-base: 1rem;
  --sf-text-small: 0.875rem;
  --sf-control-height: 2.75rem;
  --sf-radius-sm: 0.5rem;
  --sf-radius-md: 0.75rem;
  --sf-shadow-panel: 0 1px 2px rgb(23 35 61 / 0.06), 0 8px 24px rgb(23 35 61 / 0.06);
  --sf-transition: 160ms ease;
}
```

Build the shared icon component from the existing inline SVG paths, keeping `aria-hidden` for decorative icons and requiring a text or `aria-label` on icon-only buttons.

Create `components/app-shell.tsx` as a presentation-only shell. It must accept optional action and tool slots so the project center can use it in Task 4 and the full tool controller can extend it in Task 6 without changing the project-center API.

- [ ] **Step 4: Switch `app/layout.tsx` to semantic imports**

Replace every current CSS import with:

```ts
import './styles/tokens.css';
import './styles/base.css';
import './styles/auth.css';
import './styles/project-hub.css';
import './styles/workbench.css';
import './styles/panels.css';
import './styles/responsive.css';
```

Keep legacy files in the repository until Task 8, but ensure they are no longer imported.

- [ ] **Step 5: Run style, type, and build checks**

```bash
npm run test -- tests/style-architecture.test.ts
npm run typecheck
npm run build
```

Expected: PASS. Existing pages may be visually incomplete until Tasks 4–7, but must still render without a runtime exception.

- [ ] **Step 6: Commit**

```bash
git add app/layout.tsx app/styles components/ui components/app-shell.tsx tests/style-architecture.test.ts
git commit -m "style: add evidence desk design system"
```

---

### Task 4: Build the research project center

**Files:**
- Create: `components/project-hub/project-hub-model.ts`
- Create: `components/project-hub/project-table.tsx`
- Create: `components/project-hub/new-project-panel.tsx`
- Create: `components/project-hub/project-hub.tsx`
- Create: `tests/project-hub-model.test.ts`
- Modify: `components/workspace-hub.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `WorkspaceState`, `ReviewSnapshot`, `WorkspaceDraft`, `WORKFLOW_LABELS`, `SECTION_LABELS`.
- Produces: `ProjectSummary`, `buildProjectSummaries(state)`, `buildHubMetrics(state)`.
- Produces: `ProjectHubProps` with `onOpenProject`, `onCreateWorkflow`, `onOpenImport`, `onOpenHistory`, and `onOpenData`.

- [ ] **Step 1: Write failing project-summary tests**

Create `tests/project-hub-model.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildProjectSummaries } from '@/components/project-hub/project-hub-model';

describe('project hub model', () => {
  it('groups snapshots by project and exposes pending decisions', () => {
    const state = {
      draft: null,
      warnings: [],
      history: [
        {
          id: 'newer',
          projectTitle: 'ECC manuscript',
          taskType: 'precheck',
          sourceText: 'text',
          sectionType: 'methods',
          reviewMode: 'deep',
          targetJournal: 'CBM',
          supportingContext: '',
          responseLocation: '',
          lockedTerms: [],
          requestId: 'r2',
          result: { scoreAfter: 82, issues: [{ id: 'a' }, { id: 'b' }] },
          decisions: { a: 'accepted', b: 'pending' },
          savedAt: '2026-07-31T02:00:00.000Z',
        },
      ],
    };
    const [project] = buildProjectSummaries(state as never);
    expect(project.title).toBe('ECC manuscript');
    expect(project.pendingCount).toBe(1);
    expect(project.score).toBe(82);
  });
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm run test -- tests/project-hub-model.test.ts
```

Expected: FAIL because the model does not exist.

- [ ] **Step 3: Implement the pure project model**

Group current history by normalized project title, take the newest snapshot as the current summary, and count pending decisions with the preserved serialized values. Do not merge or rewrite stored history.

- [ ] **Step 4: Build the compact project center**

`ProjectHub` must render in this order:

1. Slim `AppShell` top bar.
2. Compact page heading with “新建研究任务” primary action.
3. “需要继续处理” strip only when pending decisions exist.
4. Recent-project table with project, workflow, section, readiness, pending count, save location, and modified time.
5. Empty state when no history exists.
6. Compact workflow selector inside `NewProjectPanel`.
7. Secondary data/privacy summary.

Delete the giant hero, the four giant workflow cards, and the four equal-weight metric cards from the rendered hub.

- [ ] **Step 5: Reduce `WorkspaceHub` to routing and state orchestration**

Keep `WorkspaceHub` as the compatibility entry component, but reduce it to:

```tsx
export function WorkspaceHub() {
  const controller = useWorkspaceNavigation();
  return controller.view === 'hub'
    ? <ProjectHub {...controller.hubProps} />
    : <WorkbenchShell onReturnToHub={controller.returnToHub} />;
}
```

Move backup parsing and storage reads to `lib/workspace-store.ts`. Keep the existing keys and backup format.

- [ ] **Step 6: Verify the hub**

Run:

```bash
npm run test -- tests/project-hub-model.test.ts
npm run typecheck
npm run build
```

Browser checks:

- guest enters `/` and sees the project center;
- existing local history appears without migration;
- search and workflow filter still work;
- backup export, import confirmation, and clear-local-data confirmation still work;
- opening a project preserves the selected snapshot/draft.

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx components/workspace-hub.tsx components/project-hub tests/project-hub-model.test.ts
git commit -m "feat: rebuild research project center"
```

---

### Task 5: Split PaperLens into the three-column evidence workbench

**Files:**
- Create: `components/workbench/use-workbench-controller.ts`
- Create: `components/workbench/workbench-shell.tsx`
- Create: `components/workbench/document-outline.tsx`
- Create: `components/workbench/manuscript-canvas.tsx`
- Create: `components/workbench/evidence-inspector.tsx`
- Create: `components/workbench/author-decision-bar.tsx`
- Create: `components/workbench/workflow-setup-panel.tsx`
- Create: `components/workbench/workbench-status.tsx`
- Modify: `components/paperlens-workspace.tsx`
- Modify: `components/workspace-hub.tsx`

**Interfaces:**
- Consumes: existing `POST /api/review` payload and `ReviewResult`.
- Consumes: `createEvidenceItems`, `canBatchApplyIssue`, workspace storage functions, and existing author-editing anchors.
- Produces: `WorkbenchController` with current draft, result, selected issue, decisions, applied edits, loading/error/save state, and commands.
- Produces synchronized `selectedIssueId` across outline, manuscript, and evidence panels.

- [ ] **Step 1: Extract the controller without changing behavior**

Move current `PaperLensWorkspace` state and actions into `use-workbench-controller.ts`:

```ts
export interface WorkbenchController {
  draft: WorkspaceDraft;
  result: ReviewResult | null;
  decisions: Record<string, IssueDecision>;
  selectedIssueId: string | null;
  loading: boolean;
  error: string;
  saveState: 'idle' | 'saved-local' | 'saved-cloud' | 'sync-pending' | 'failed';
  selectIssue(id: string): void;
  runWorkflow(): Promise<void>;
  setDecision(issueId: string, decision: IssueDecision): void;
  applyIssue(issueId: string): void;
  applyAllEligible(): void;
  undo(): void;
  redo(): void;
}
```

Keep request validation, `/api/review`, request IDs, local history, report exports, terminology locks, and sample loading behavior unchanged.

- [ ] **Step 2: Add controller-focused tests**

Extract pure reducers into the same module or `lib/workbench-state.ts` and test:

```ts
expect(selectIssue(initialState, 'issue-2').selectedIssueId).toBe('issue-2');
expect(setIssueDecision(initialState, 'issue-2', 'deferred').decisions['issue-2']).toBe('deferred');
expect(setIssueDecision(initialState, 'issue-2', 'dismissed').decisions['issue-2']).toBe('dismissed');
```

Run the focused test and verify it fails before implementing the reducer.

- [ ] **Step 3: Implement the left document outline**

`DocumentOutline` shows:

- section list from imported document metadata when available;
- current configured section as a fallback when only one text block exists;
- total, high-risk, medium-risk, low-risk, pending, and completed counts;
- running state for the four Agents in a compact status area;
- a clear selected row tied to `selectedIssueId`.

Agent rows are secondary metadata; they do not occupy a dedicated large card.

- [ ] **Step 4: Implement the manuscript canvas**

`ManuscriptCanvas` supports:

- `original`, `suggested`, and `diff` views;
- readable paper width and 16px body copy;
- active issue highlighting when a safe text anchor exists;
- original/suggested pair when a full inline highlight is unavailable;
- a pre-application diff for the active issue;
- applied-edit state plus undo/redo.

Do not attempt to render full DOCX page layout. Label this as a text review canvas.

- [ ] **Step 5: Implement the evidence inspector**

For the selected issue show:

- issue number, category, Agent, severity, location;
- original and suggested text;
- reason and `meaningChanged` warning;
- anchor state and safety message;
- decision buttons bound to the compatible values:

```tsx
<button onClick={() => setDecision(id, 'accepted')}>接受</button>
<button onClick={() => setDecision(id, 'dismissed')}>拒绝</button>
<button onClick={() => setDecision(id, 'deferred')}>保留待定</button>
```

- an “应用到文稿” action only after acceptance and safe anchoring.

- [ ] **Step 6: Implement the contextual author decision bar**

Show the bar only when a result exists. It includes previous/next issue, decision progress, and “批量应用低风险建议”. The batch action uses `canBatchApplyIssue` and reports how many issues were applied and skipped.

- [ ] **Step 7: Replace the old workbench render**

Make `PaperLensWorkspace` a compatibility wrapper:

```tsx
export function PaperLensWorkspace() {
  return <WorkbenchShell />;
}
```

Remove the large workbench hero, duplicated result tabs, and persistent four-Agent rail from the rendered page. Preserve exports through the new export panel.

- [ ] **Step 8: Run gates and browser checks**

```bash
npm run test
npm run typecheck
npm run build
```

Browser checks:

- all four workflows create valid requests;
- selecting an issue synchronizes all three columns;
- accepted, dismissed, and deferred decisions persist in history;
- safe single apply, restricted batch apply, undo, and redo work;
- a partial Agent failure remains visible without discarding completed Agent results;
- report, JSON, text, and decision-log exports still download.

- [ ] **Step 9: Commit**

```bash
git add components/paperlens-workspace.tsx components/workspace-hub.tsx components/workbench tests
git commit -m "feat: add three-column evidence workbench"
```

---

### Task 6: Consolidate account, cloud, import, editing, and DOCX tools into the app shell

**Files:**
- Create: `components/app-tools.tsx`
- Create: `components/panels/account-panel.tsx`
- Create: `components/panels/cloud-workspace-panel.tsx`
- Create: `components/panels/document-import-panel.tsx`
- Create: `components/panels/history-panel.tsx`
- Create: `components/panels/author-editing-panel.tsx`
- Create: `components/panels/original-docx-patch-panel.tsx`
- Create: `components/panels/export-panel.tsx`
- Modify: `components/app-shell.tsx`
- Modify: `app/layout.tsx`
- Delete: `components/account-dock.tsx`
- Delete: `components/cloud-workspace-dock.tsx`
- Delete: `components/document-import-dock.tsx`
- Delete: `components/author-editing-dock.tsx`
- Delete: `components/original-docx-patch-dock.tsx`

**Interfaces:**
- Produces: `ToolPanelId = 'import' | 'history' | 'cloud' | 'editing' | 'original-docx' | 'export' | 'account'`.
- Produces: controlled panel props `{ open: boolean; onClose(): void }`.
- Consumes existing authentication, cloud, ingestion, author-editing, and DOCX patch services unchanged.

- [ ] **Step 1: Create the controlled app shell**

`AppShell` renders:

- brand and current project breadcrumb;
- local/cloud save status;
- version;
- undo and redo when inside a project;
- one “文档与工具” menu;
- export primary action;
- account menu.

Only one context panel can be open at a time.

- [ ] **Step 2: Extract panel bodies from floating docks**

For each existing dock, move business logic and modal body to its corresponding controlled panel. Update every import to the new panel first, then delete the old Dock file in this same task. Do not keep empty wrappers and do not duplicate stateful logic.

- [ ] **Step 3: Preserve import behavior**

`DocumentImportPanel` must continue to:

- accept DOCX and text-based PDF;
- parse locally;
- preview detected sections;
- select workflow and mode;
- preserve an original DOCX package in IndexedDB;
- bind SHA-256 source text;
- write the same compatible draft and last-import records;
- display OCR and complex-layout boundaries.

Use an `onImported(draft)` callback to navigate without forcing a full page reload where possible.

- [ ] **Step 4: Preserve cloud and account behavior**

`CloudWorkspacePanel` continues to use `readLocalWorkspace`, `syncCurrentLocalProject`, `syncAllLocalProjects`, `writeLocalWorkspace`, and Supabase RLS. Guest mode must clearly state that projects remain browser-local.

`AccountPanel` keeps sign-out and guest/cloud mode, but uses a normal anchored menu instead of MutationObserver-based portal injection.

- [ ] **Step 5: Preserve author editing and DOCX delivery**

`AuthorEditingPanel` keeps:

- safe anchor analysis;
- single apply;
- stricter low-risk batch apply;
- undo, redo, reset, and write-back;
- clean and tracked DOCX export.

`OriginalDocxPatchPanel` keeps:

- IndexedDB binding lookup;
- original package load;
- safe OOXML patch and skip report;
- local-only processing statement.

- [ ] **Step 6: Remove global floating mounts**

In `app/layout.tsx`, replace:

```tsx
<AccountDock />
<CloudWorkspaceDock />
<DocumentImportDock />
<AuthorEditingDock />
<OriginalDocxPatchDock />
```

with the single application shell rendered by the page/workspace composition. `AuthProvider` and `AuthGate` remain at the root.

- [ ] **Step 7: Verify all utility paths**

Run:

```bash
npm run test
npm run typecheck
npm run build
```

Browser checks:

- only one tool menu is visible;
- no utility trigger floats over content;
- imports open from project center and workbench;
- cloud sync and account menus work;
- author editing and both DOCX export paths work;
- closing a panel restores keyboard focus to its trigger.

- [ ] **Step 8: Commit**

```bash
git add app/layout.tsx components/app-shell.tsx components/app-tools.tsx components/panels components
git commit -m "refactor: consolidate workspace tools"
```

---

### Task 7: Rebuild login, responsive layouts, accessibility, and error states

**Files:**
- Modify: `app/login/page.tsx`
- Modify: `components/auth-gate.tsx`
- Modify: `app/styles/auth.css`
- Modify: `app/styles/project-hub.css`
- Modify: `app/styles/workbench.css`
- Modify: `app/styles/panels.css`
- Modify: `app/styles/responsive.css`
- Modify: `components/workbench/workbench-shell.tsx`
- Modify: `components/workbench/workbench-status.tsx`

**Interfaces:**
- Consumes the existing `useAuth()` API and workbench controller error/save states.
- Produces mobile panel state `'outline' | 'manuscript' | 'evidence' | 'decision'`.

- [ ] **Step 1: Simplify the login page**

Keep sign-in, sign-up, reset, visitor entry, configuration-aware states, and safe `next` handling. Replace the large Agent board and numeric marketing grid with:

- compact product identity;
- one restrained statement about evidence-aware review;
- local/cloud data boundary;
- login/visitor card.

Do not show unverifiable marketing metrics.

- [ ] **Step 2: Implement responsive behavior**

Use these breakpoints:

```css
@media (min-width: 1180px) { /* resizable three columns */ }
@media (min-width: 768px) and (max-width: 1179px) { /* outline + manuscript; evidence drawer */ }
@media (max-width: 767px) { /* one active panel; bottom navigation */ }
```

On mobile, the bottom navigation labels are “结构、正文、证据、决策”. Do not compress all three desktop columns into one viewport.

- [ ] **Step 3: Implement accessible interaction states**

Verify:

- visible `:focus-visible` outlines;
- 44px minimum primary controls;
- `aria-current` on selected navigation;
- `aria-selected` on tabs;
- `aria-live` for save, run, and export states;
- dialog titles and focus return;
- severity and decision states include text/icons, not color alone;
- `prefers-reduced-motion: reduce` disables nonessential transitions.

- [ ] **Step 4: Implement explicit error and empty states**

Add exact user states:

- “文档解析失败” with supported formats and retry;
- “扫描型 PDF 暂不支持 OCR”;
- “部分 Agent 未完成” with completed results retained;
- “本地已保存，等待云端同步”;
- “无法安全定位，需作者人工确认”;
- “导出失败，项目状态已保留”;
- no project, no result, no evidence, all decisions complete, and offline.

- [ ] **Step 5: Run browser matrix**

Verify at:

- desktop `1440 × 1000`;
- tablet `1024 × 768`;
- mobile `390 × 844`.

Test both a guest session and a Supabase-authenticated session when configuration is available.

- [ ] **Step 6: Run automated gates and commit**

```bash
npm run test
npm run typecheck
npm run build
git add app/login/page.tsx components/auth-gate.tsx components/workbench app/styles
git commit -m "fix: complete responsive accessible workspace"
```

---

### Task 8: Remove legacy UI layers and synchronize v1.5 runtime metadata

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `app/api/health/route.ts`
- Modify: `app/layout.tsx`
- Modify: `components/workspace-hub.tsx`
- Modify: `components/paperlens-workspace.tsx`
- Delete: `app/globals.css`
- Delete: `app/v04.css`
- Delete: `app/auth.css`
- Delete: `app/auth-inline.css`
- Delete: `app/auth-gate.css`
- Delete: `app/v06.css`
- Delete: `app/workbench-responsive.css`
- Delete: `app/v07.css`
- Delete: `app/v08.css`
- Delete: `app/v09.css`
- Delete: `app/v10.css`
- Delete: `app/v11.css`
- Delete: `app/v12.css`
- Delete: `app/v13.css`
- Delete: `app/history-preview.css`
- Delete: `app/product-ui.css`

**Interfaces:**
- Consumes: `APP_VERSION` from `lib/app-config.ts`.
- Produces: health metadata describing the Evidence Desk experience.

- [ ] **Step 1: Make runtime metadata use the shared version**

Set `package.json` to `1.5.0`. Import `APP_VERSION` in `app/api/health/route.ts`, `WorkspaceHub`, and any remaining runtime badge instead of declaring local version constants.

Update health metadata:

```ts
version: APP_VERSION,
ui: 'evidence-desk-research-workspace',
experienceSystem: {
  styleLayers: ['tokens', 'base', 'auth', 'project-hub', 'workbench', 'panels', 'responsive'],
  threeColumnEvidenceWorkspace: true,
  authorDecisionFirst: true,
  mobileSinglePanelNavigation: true,
  reducedMotionSupport: true,
},
```

Keep all truthful capability fields for import, Agent workflows, safe apply, history, cloud, and DOCX export.

- [ ] **Step 2: Confirm no legacy selectors are required**

Search:

```bash
rg "v04|v06|v07|v08|v09|v10|v11|v12|v13|product-ui|history-preview|workbench-responsive" app components
```

Expected: no imports or runtime references.

- [ ] **Step 3: Delete the legacy style files**

Delete only the listed CSS files after Task 7 visual regression succeeds. Do not delete non-UI assets or service files.

- [ ] **Step 4: Run the complete local gate**

```bash
npm install
npm audit --omit=dev --audit-level=high
npm run test
npm run typecheck
npm run build
```

Expected: all commands exit `0`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json app/api/health/route.ts app/layout.tsx components/workspace-hub.tsx components/paperlens-workspace.tsx app
git commit -m "chore: release ScholarForge OS v1.5"
```

---

### Task 9: Deploy the branch preview and capture final real screenshots

**Files:**
- Create: `docs/readme-assets/screenshots/01-login.png`
- Create: `docs/readme-assets/screenshots/02-project-hub.png`
- Create: `docs/readme-assets/screenshots/03-document-import.png`
- Create: `docs/readme-assets/screenshots/04-evidence-workbench.png`
- Create: `docs/readme-assets/screenshots/05-author-decision.png`
- Create: `docs/readme-assets/screenshots/06-history-export.png`

**Interfaces:**
- Consumes the Vercel preview for `agent/scholarforge-v1-5-redesign`.
- Produces public-safe PNG assets used by README and Feishu.

- [ ] **Step 1: Push and wait for preview checks**

```bash
git push -u origin agent/scholarforge-v1-5-redesign
```

Verify GitHub Actions and the Vercel branch preview reach a successful terminal state before capturing.

- [ ] **Step 2: Prepare public-safe demonstration data**

Use the repository’s built-in NMR/ECC demonstration manuscript. Do not use private unpublished manuscript files, personal email addresses, API keys, Supabase identifiers, or browser developer overlays.

Generate an ephemeral DOCX fixture from the built-in public demonstration text for the import screenshot:

```bash
node -e "const fs=require('node:fs'); const {Document,Packer,Paragraph,HeadingLevel}=require('docx'); const doc=new Document({sections:[{children:[new Paragraph({text:'NMR Methods Demonstration',heading:HeadingLevel.HEADING_1}),new Paragraph('Low-field nuclear magnetic resonance tests were conducted to characterize pore structure. This public demonstration paragraph contains no private manuscript data.')] }]}); Packer.toBuffer(doc).then(buffer=>fs.writeFileSync('/tmp/scholarforge-demo-manuscript.docx',buffer));"
```

Upload `/tmp/scholarforge-demo-manuscript.docx` only to the browser import panel. Do not commit the temporary fixture.

- [ ] **Step 3: Capture the six desktop screenshots**

Use a `1440 × 1000` viewport:

1. `/login` in visitor-ready state.
2. Project center with demonstration history.
3. Import panel after a public-safe DOCX/PDF is parsed and before import confirmation.
4. Three-column workbench with a selected evidence item.
5. Evidence inspector showing risk, reason, and author decision controls.
6. History/export view with available deliverables.

Crop only browser chrome; do not alter the product UI in an image editor.

- [ ] **Step 4: Verify image quality**

For each image confirm:

- no clipped controls;
- no loading spinner;
- no private information;
- text is readable;
- displayed version is `1.5.0`;
- filename matches the required sequence.

- [ ] **Step 5: Commit screenshots**

```bash
git add docs/readme-assets/screenshots
git commit -m "docs: add v1.5 product screenshots"
git push
```

---

### Task 10: Rewrite README and synchronize repository documentation links

**Files:**
- Modify: `README.md`
- Modify: `README.en.md`

**Interfaces:**
- Consumes the six final screenshot paths and deployed feature truth.
- Produces a neutral public README with Feishu document links.

- [ ] **Step 1: Rewrite the Chinese README**

Use this exact section order:

1. Title, concise positioning, live app, product document, technical document.
2. `04-evidence-workbench.png` as the primary screenshot.
3. “论文—证据—作者决策” workflow.
4. Four workflow table.
5. Evidence and author-decision model.
6. Document import and DOCX delivery.
7. Guest/cloud data boundaries.
8. Technical architecture.
9. Local setup and environment variables.
10. Verification commands and current limitations.
11. Screenshot gallery.
12. License statement.

Use the existing Feishu URLs:

```text
产品文档：https://dcnua2ebj1ej.feishu.cn/wiki/IuKGwEAU9isxlck4V8ec8jJcnpe
技术文档：https://dcnua2ebj1ej.feishu.cn/wiki/JGxewZQa5izFL0kKQMycXkC9n0c
```

Remove stale v1.3 badges and repo-local PRD/technical links from the primary navigation. Keep detailed repo-local deployment pages only where they remain useful.

- [ ] **Step 2: Synchronize the English README**

Translate the same implemented capabilities and boundaries. Do not leave v1.3/v1.4 version strings or claims that conflict with the Chinese README.

- [ ] **Step 3: Validate links and screenshots**

```bash
rg -n "v0\\.3|v1\\.3|v1\\.4|app-v1\\.3|docs/PRD\\.md|docs/technical\\.md" README.md README.en.md
```

Expected: no stale primary version or primary documentation links. Historical release links may remain only when explicitly labeled historical.

Verify each Markdown image path exists.

- [ ] **Step 4: Commit**

```bash
git add README.md README.en.md
git commit -m "docs: rewrite v1.5 project readme"
git push
```

---

### Task 11: Rewrite the two existing Feishu documents with final screenshots

**External resources:**
- Product document: `https://dcnua2ebj1ej.feishu.cn/wiki/IuKGwEAU9isxlck4V8ec8jJcnpe`
- Technical document: `https://dcnua2ebj1ej.feishu.cn/wiki/JGxewZQa5izFL0kKQMycXkC9n0c`
- Screenshot source: `docs/readme-assets/screenshots/*.png`

**Interfaces:**
- Consumes the final deployed v1.5 product and README facts.
- Produces two updated Feishu documents while preserving their URLs and public read-only permissions.

- [ ] **Step 1: Rewrite the product document**

Use this exact structure:

1. 文档信息与 v1.5.0 状态
2. 产品概述
3. 目标用户与核心问题
4. 产品原则：作者主导、证据可追溯、修改可复核
5. 研究项目中心
6. 三栏证据工作台
7. 四种科研英语工作流
8. 导入—审阅—决策—导出用户旅程
9. 作者决策与安全应用规则
10. 访客模式、云端模式与隐私边界
11. 真实界面截图
12. 当前限制
13. 路线图

Insert screenshots 01–06 at the relevant sections with Chinese captions.

- [ ] **Step 2: Rewrite the technical document**

Use this exact structure:

1. 文档信息与 v1.5.0 状态
2. 系统目标与非目标
3. 技术栈
4. 前端模块与目录
5. 项目中心和三栏工作台状态流
6. 四 Agent 请求与确定性聚合
7. 统一审阅问题与作者决策数据
8. DOCX/PDF/文本导入
9. localStorage、IndexedDB、Supabase 和 RLS
10. 安全锚点、冲突保护、撤销重做
11. clean/tracked DOCX 与原包 OOXML 补丁
12. 错误处理和恢复策略
13. 部署、环境变量和 CI
14. 测试矩阵
15. 已知限制和扩展点

Insert architecture-relevant screenshots and ensure all limits match `/api/health`.

- [ ] **Step 3: Preserve permissions and verify publication**

Confirm:

- both original URLs still open;
- both titles remain identifiable as ScholarForge OS product/technical documentation;
- public access remains read-only;
- no v0.3, v1.3, or v1.4 “current version” remains;
- screenshots render for an unauthenticated reader;
- links to the live app and GitHub repository work.

---

### Task 12: Final regression, PR evidence, and review handoff

**Files:**
- Modify: PR #25 description and status only after checks pass.

**Interfaces:**
- Consumes all implementation commits, screenshots, README, Feishu documents, GitHub Actions, and Vercel preview.
- Produces a review-ready PR with verifiable evidence.

- [ ] **Step 1: Run the final local gate from a clean checkout**

```bash
npm install
npm audit --omit=dev --audit-level=high
npm run test
npm run typecheck
npm run build
```

Record the exact successful command outputs in the PR summary.

- [ ] **Step 2: Run the final browser regression**

Verify:

- `/login` sign-in, sign-up when configured, reset, and visitor entry;
- project hub create, search, filter, resume, backup, restore, and clear confirmations;
- all four workflows;
- three-column synchronization;
- accept/reject/retain decisions;
- safe single apply and restricted batch apply;
- undo/redo;
- history;
- text, Markdown, JSON, clean DOCX, tracked DOCX, and original DOCX patch exports;
- guest storage and cloud sync;
- desktop, tablet, and mobile layouts;
- offline, partial Agent failure, unsafe anchor, import failure, and export failure states.

- [ ] **Step 3: Verify version and documentation consistency**

```bash
rg -n "1\\.3\\.|1\\.4\\.|0\\.3\\." package.json app components README.md README.en.md
```

Expected: no active product version other than `1.5.0`; historical references must be explicitly labeled as historical.

Check the live `/api/health` response reports `1.5.0`.

- [ ] **Step 4: Update draft PR #25**

Add:

- concise change summary;
- before/after UX explanation;
- data compatibility statement;
- test/build/audit results;
- Vercel preview URL;
- screenshot links;
- Feishu product and technical document links;
- remaining known limitations.

Mark the PR ready for review only after all automated and browser checks pass.

- [ ] **Step 5: Request final review**

Do not merge automatically. Ask the user to review:

- the Vercel preview;
- six screenshots;
- README;
- both Feishu documents;
- PR #25 checks and diff.
