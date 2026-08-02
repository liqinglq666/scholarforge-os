# ScholarForge OS

[简体中文](README.md) · [English](README.en.md)

**An author-controlled workspace for scientific English review and revision.**

ScholarForge OS serves graduate students, researchers, and academic editors working with Chinese or English scientific passages. It is not a paper generator and does not replace author judgment. AI produces explainable suggestions; the author accepts, rejects, or defers each issue. Only a single suggestion that is uniquely anchored in the current working draft and does not change scientific meaning can be applied automatically.

## Product scope

The product keeps three core tasks:

| Task | Purpose | Explicit boundary |
| --- | --- | --- |
| Scientific Chinese-to-English | Produce reviewable academic English | Preserve values, units, terminology, and claim strength |
| Conservative English polishing | Improve grammar, syntax, wording, concision, and cohesion | Do not add facts, citations, experiments, or stronger claims |
| Pre-submission check | Identify language, terminology, logic, reporting, and evidence-boundary issues | No readiness score, acceptance prediction, or peer-review claim |

PDF, OCR, automated reviewer responses, accounts, cloud sync, collaboration, original-OOXML patching, Word tracked changes, unreliable scoring, and batch apply are intentionally unsupported.

## Core flow

1. Understand product scope, data handling, and AI limitations on the welcome page.
2. Paste text or extract DOCX body text locally and select one section.
3. Choose a task and section; optionally add journal context and terminology locks.
4. Confirm the exact payload before sending. The original DOCX is never uploaded.
5. Compare the immutable source, AI suggestion, author working draft, and issue list.
6. Decide every issue and revalidate the current anchor before applying one suggestion.
7. Undo or redo changes; export TXT, a Markdown report, a clean DOCX, or a workspace backup.
8. Restore browser-local history from one canonical Recent Tasks page.

## Scientific safety boundary

After model generation, deterministic code checks numbers, scientific notation, percentages, values with units, terminology locks, invented DOI strings, empty/oversized/truncated/non-JSON output, placeholders, duplicate issue IDs, field lengths, anchor uniqueness, cross-paragraph edits, author-required content, and potential meaning changes.

Passing these checks does not make the output scientifically correct. The author must still verify facts, references, statistics, experimental parameters, sample counts, causality, methods, claim strength, and current journal requirements.

When the model is not configured, the workbench disables analysis and `POST /api/review` returns `503`. No simulated result is generated or saved.

## Data and recovery

- The draft, review result, decisions, working copy, and 12 recent tasks are stored in browser `localStorage`.
- DOCX parsing happens in the browser. Original binary files are neither uploaded nor retained.
- Only an author-confirmed payload is sent to the server and model.
- Importing a backup validates size, format, and version. Stored edit offsets and replacement text are not trusted; safe edits are rebuilt from current issues.

See [Product](docs/product.md), [Architecture](docs/ARCHITECTURE.md), [Technical and Security](docs/technical.md), [Privacy](docs/PRIVACY.md), and [Deployment](docs/DEPLOYMENT.md).

## Local development

Node.js `>= 22.12.0` is required.

```bash
git clone https://github.com/liqinglq666/scholarforge-os.git
cd scholarforge-os
npm ci
cp .env.example .env.local
npm run dev
```

```env
DASHSCOPE_API_KEY=your_server_side_key
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=qwen-plus
REVIEW_DAILY_REQUEST_BUDGET=0
```

`DASHSCOPE_API_KEY` is server-only. A daily budget of `0` disables the request-count circuit breaker; production deployments should set an appropriate positive limit.

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

## Deployment limitations

The current rate limiter is per Node.js instance. A public multi-instance deployment should use shared rate-limit storage plus platform WAF controls, monitoring, and provider cost limits. Browser-local workspaces do not sync across devices. DOCX extraction and clean export do not preserve the source document's layout or complex objects. The product does not verify reference authenticity, statistical correctness, journal rules, or acceptance readiness.

The repository currently has no standalone open-source license file. The owner should add an explicit license before public redistribution or third-party reuse.
