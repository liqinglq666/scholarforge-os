# ScholarForge OS

[简体中文](README.md)

> **Stop high-risk AI edits before they enter a scientific manuscript.**  
> The model proposes. Code checks. The author decides.

ScholarForge OS is a scientific-fact safety review workspace for graduate students, researchers, and academic editors. It places an independent **ScholarForge Safety Gate** between model-generated revisions and the author's working manuscript.

- Public application: `https://scholarforge-os.vercel.app`
- Recommended evaluator path: `/try`
- Safety rules and test scope: `/trust`
- User guide: `/guide`

The evaluator does not need to download the repository, deploy dependencies, create an account, or provide an API key.

## Why a safety gate is needed

Language models can improve scientific writing, but they may also silently alter:

- values, percentages, sample sizes, or scientific notation;
- value-and-unit combinations;
- author-year citations or DOI strings;
- protected terminology, material names, scales, algorithms, and abbreviations;
- experimental or methodological actions not present in the source;
- association versus causation;
- cautious versus definitive conclusions;
- a limited sample versus a universal population.

ScholarForge treats the **AI edit itself as an object that must be reviewed**.

```text
AI generates a candidate revision
             ↓
ScholarForge Safety Gate
numbers | units | citations | terminology | experiments | causality | certainty | scope
             ↓
Author-controlled decisions
accept | reject | defer | safely apply | undo | export
```

## Three permission layers

### 1. The model only proposes candidates

Alibaba Cloud Model Studio generates a complete candidate text, issue evidence, and explanations. It cannot overwrite the author working draft and cannot grant itself automatic-application permission.

### 2. Code independently evaluates the candidate

After model generation, application code checks scientific-fact invariants. A candidate that violates a hard rule is returned as **quarantined**, not reduced to an opaque error.

While quarantined:

- the immutable source remains available;
- the author working draft remains unchanged;
- the candidate is visible only for risk inspection;
- all automatic application is disabled;
- the interface shows the checks and blocking evidence.

### 3. The author controls the final text

Even a candidate that passes the current safety gate must be reviewed issue by issue. A local edit can be applied only when the current source fragment is uniquely anchored, remains within one paragraph, does not change protected facts or claims, and does not overlap an existing edit.

## Recommended evaluator flow

Open `/try` and complete the core path without signing in:

1. Load the public biomedical discussion example.
2. Choose the pre-submission check task.
3. Confirm the exact text and settings being sent.
4. Run the real server-configured Model Studio request.
5. Inspect the Safety Gate evidence.
6. Accept, reject, or defer individual suggestions.
7. Apply only code-authorized local edits.
8. Try undo, redo, and export.

The example is synthetic public scientific text. Loading it only fills the local browser draft; it does not call the model automatically.

## Core tasks

| Task | Purpose | Hard boundary |
| --- | --- | --- |
| Scientific Chinese-to-English | Produce reviewable academic English | Preserve values, units, terminology, citations, and claim strength |
| Conservative English polishing | Improve grammar, syntax, concision, and cohesion | Do not add facts, experiments, citations, or stronger conclusions |
| Pre-submission check | Identify language, reporting, logic, and evidence-boundary risks | No acceptance prediction, readiness score, or peer-review claim |

## Full manuscript workflow

Beyond the public quick-review path, ScholarForge supports:

- multiple manuscript projects and chapters;
- target-journal context and project terminology rules;
- browser-local cross-chapter consistency checks;
- explicit chapter selection before AI review;
- supervisor-feedback tracking and response notes;
- version comparisons and recovery;
- TXT, Markdown, clean DOCX, and JSON workspace exports.

## Data and privacy

- Manuscripts, chapters, feedback, version text, analysis history, and author decisions are stored in browser `localStorage` by default.
- DOCX body extraction happens in the browser; the original binary is not uploaded.
- Text and settings are sent only after the user explicitly starts an analysis.
- `DASHSCOPE_API_KEY` is read only on the server.
- Optional Supabase authentication synchronizes validated personalization preferences only.
- Signing in does not upload manuscript text, feedback, full versions, or analysis history.
- When the model is not configured, analysis is disabled and `POST /api/review` returns `503`; no simulated result is created.

## Technical architecture

```text
Next.js 16 App Router + React 19 + TypeScript
├─ public evaluator routes: /try /trust /guide
├─ multi-project browser workspace
├─ browser DOCX extraction with Mammoth
├─ POST /api/review
│  ├─ schema and byte-size validation
│  ├─ session/IP rate limits, concurrency, timeout, budget fuse
│  ├─ Alibaba Cloud Model Studio compatible endpoint
│  ├─ strict structured-output validation
│  └─ ScholarForge Safety Gate
├─ code-derived automatic-application permission
├─ unique text anchoring, overlap checks, undo and redo
├─ cross-chapter consistency checks
└─ TXT / Markdown / clean DOCX / JSON backup
```

## Local development

Node.js `>=22.12.0` is required.

```bash
git clone https://github.com/liqinglq666/scholarforge-os.git
cd scholarforge-os
npm ci
cp .env.example .env.local
npm run dev
```

Model configuration:

```env
DASHSCOPE_API_KEY=your_server_side_key
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=qwen-plus
REVIEW_DAILY_REQUEST_BUDGET=0
```

Optional account configuration:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Run `supabase/migrations/202608020001_user_preferences.sql` before enabling cloud preference sync.

## Verification

```bash
npm ci
npm audit --omit=dev --audit-level=high
npm run lint
npm run test
npm run typecheck
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

The final competition branch currently verifies unit, API, component, production-build, desktop-browser, and mobile-browser contracts in CI.

## Known limitations

- Passing the Safety Gate does not prove scientific correctness.
- The system does not verify raw data, statistics, reference content, ethics, or current journal rules.
- Rule and model checks can produce false positives and false negatives.
- DOCX import/export does not preserve all formulas, tables, footnotes, comments, tracked changes, or source formatting.
- Full manuscript workspaces do not sync across devices; the optional account synchronizes preferences only.
- The current in-memory rate limiter is per server instance and should be replaced by shared atomic storage for larger multi-instance traffic.
- The repository currently has no standalone open-source license file.

ScholarForge output is decision support, not a publication, medical, statistical, ethical, or legal guarantee. The author remains responsible for the final manuscript.
