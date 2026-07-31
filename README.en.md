# ScholarForge OS

[简体中文](README.md) · [English](README.en.md)

<p align="center">
  <img src="public/scholarforge-lockup.svg" alt="ScholarForge OS" width="420" />
</p>

<p align="center"><strong>An evidence-first workspace for scientific English and author-controlled revision</strong></p>

ScholarForge OS supports scientific translation, conservative polishing, pre-submission review, and reviewer-response drafting. Model suggestions are never written into the manuscript automatically. Each finding becomes a traceable evidence item that the author can inspect, accept, defer, or reject before applying a safely anchored edit.

<p align="center">
  <a href="https://scholarforge-os.vercel.app">Live application</a> ·
  <a href="https://scholarforge-os.vercel.app/api/health">Health endpoint</a> ·
  <a href="docs/ARCHITECTURE.md">Architecture</a>
</p>

## Core flow

```text
Import DOCX / text-based PDF / paste text
→ select workflow and manuscript section
→ run four specialist agents in parallel
→ normalize findings into evidence items
→ author accepts, defers, or rejects
→ safely anchored edits enter the working manuscript
→ export TXT / Markdown / JSON / DOCX
```

| Workflow | Purpose | Boundary |
| --- | --- | --- |
| Scientific translation | Chinese scientific text to academic English | preserves terminology, numbers, and claim strength |
| Conservative polishing | grammar, collocation, and academic tone | does not invent facts or strengthen conclusions |
| Pre-submission review | terminology, language, logic, and methods audit | assists authors; does not replace peer review |
| Reviewer response | evidence-bounded response drafting | missing evidence and locations remain explicit author actions |

## Evidence Desk

The interface is organized around a project center and a three-column review workbench:

- **Structure and issue queue** for setup, terminology locks, risk, and pending findings.
- **Manuscript canvas** for original, suggested, working, and diff views.
- **Evidence inspector** for source agent, risk, location, rationale, comparison, and author decision.
- **Contextual decision bar** for navigation, progress, and restricted low-risk batch application.

Agents are evidence producers, not the primary interface. The product centers on manuscript, evidence, and author decision.

## Safe author editing

Persisted issue decisions remain compatible: `pending`, `accepted`, `deferred`, and `dismissed`.

An edit may be applied only when the source anchor is unique, complete, within one paragraph, and conflict-free. Terminology, numerical, citation, conclusion, major, logic/method, or meaning-changing findings cannot be batch-applied. Unsafe findings remain manual author tasks.

The working manuscript supports undo and redo.

## Import and export

Browser-side import supports semantic DOCX text, text-based PDF extraction, common manuscript-section detection, section preview, and paragraph-aware splitting to the current 12,000-character task limit.

Scanned-PDF OCR and full-fidelity Word page reconstruction are outside the current scope.

Exports include suggested text, an evidence report, structured JSON, a clean editable DOCX, and a tracked-changes DOCX for safely applied edits.

## Data and privacy

The current release is explicitly local-first:

- the draft and eight most recent review snapshots are stored in browser `localStorage`;
- versioned JSON backup and restore are available;
- source DOCX/PDF files are not uploaded automatically;
- only author-selected text is sent when a workflow is deliberately run;
- the Model Studio API key is read only from server environment variables.

Browser data does not automatically follow the user across devices.

## Stack

Next.js 16, React 19, TypeScript 5.8, Alibaba Cloud Model Studio, Mammoth, Mozilla PDF.js, docx.js, Vitest, and GitHub Actions.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Local development

Node.js `>= 22.12.0` is required.

```bash
git clone https://github.com/liqinglq666/scholarforge-os.git
cd scholarforge-os
npm install
cp .env.example .env.local
npm run dev
```

```env
DASHSCOPE_API_KEY=your_key
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=qwen-plus
```

Without an API key, the application uses clearly marked safe demonstration results.

## Verification

```bash
npm audit --omit=dev --audit-level=high
npm run test
npm run typecheck
npm run build
```

## Current limitations

- 12,000 characters per primary task input;
- no OCR for scanned PDFs;
- complex Word/PDF layouts may affect extraction order;
- no automatic cross-device project synchronization;
- authors remain responsible for facts, statistics, citations, and journal compliance;
- readiness scores are internal assistance, not journal decisions.

## License

Copyright © ScholarForge OS contributors. No default permission to copy, modify, or redistribute is granted until a license is explicitly declared.
