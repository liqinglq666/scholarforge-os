# ScholarForge OS

[简体中文](README.md) | [English](README.en.md)

<p align="center">
  <img src="public/scholarforge-lockup.svg" alt="ScholarForge OS logo" width="440" />
</p>

<p align="center">
  <strong>A document-aware, Model Studio-powered multi-agent workspace for scientific writing</strong>
</p>

<p align="center">
  Import DOCX or text-based PDF sections, then run scientific translation, conservative polishing,<br />
  pre-submission review, or reviewer-response workflows with shared guardrails and author decisions.
</p>

<p align="center">
  <a href="https://scholarforge-os.vercel.app">Live Demo</a> ·
  <a href="https://scholarforge-os.vercel.app/login">Sign in</a> ·
  <a href="docs/PRD.md">PRD</a> ·
  <a href="docs/technical.md">Technical Docs</a> ·
  <a href="docs/cloud-workspace.md">Cloud Workspace Setup</a>
</p>

<p align="center">
  <img alt="App v1.1.0" src="https://img.shields.io/badge/app-v1.1.0-17233d" />
  <img alt="Alibaba Cloud Model Studio" src="https://img.shields.io/badge/Alibaba%20Cloud-Model%20Studio-ff6a00" />
  <img alt="Model qwen-plus" src="https://img.shields.io/badge/model-qwen--plus-7c3aed" />
  <img alt="Four parallel agents" src="https://img.shields.io/badge/workflow-4%20parallel%20agents-0f766e" />
  <img alt="DOCX and PDF ingestion" src="https://img.shields.io/badge/import-DOCX%20%2B%20PDF-b56836" />
  <img alt="Supabase Auth and RLS" src="https://img.shields.io/badge/cloud-Supabase%20Auth%20%2B%20RLS-3ecf8e" />
</p>

---

## Product scope

ScholarForge OS is an evidence-aware scientific writing system for graduate students, researchers, supervisors, and academic editors.

> **Models make specialist judgments; code owns constraints, protection, scoring, and final workflow state.**

The product currently supports:

- browser-side DOCX and text-based PDF extraction;
- automatic Abstract, Introduction, Methods, Results, Discussion, and Conclusion detection;
- Chinese-to-academic-English translation;
- conservative English polishing;
- reviewer-style pre-submission review;
- evidence-bounded reviewer-response drafting;
- terminology locks and numeric guardrails;
- accept, defer, dismiss, or keep-pending author decisions;
- local project history and structured exports;
- optional Supabase cloud projects with cross-device restore and RLS isolation.

## v1.1 document ingestion

Open **Import Manuscript** from the lower-left action in the authenticated workspace.

Supported input:

- `.docx`;
- text-based `.pdf`;
- up to 20 MB per file.

```text
Select DOCX / PDF
  ↓
Browser-side extraction
  ↓
Section and page-range detection
  ↓
Preview text and extraction warnings
  ↓
Select one section or chunk
  ↓
Import into PaperLens
  ↓
Verify the text, then start the four-agent workflow
```

### Processing boundary

- Mammoth reads DOCX semantic headings and text.
- Mozilla PDF.js extracts selectable PDF text page by page.
- Sections above the existing 12,000-character workflow limit are split at paragraph boundaries.
- The original file is not persisted as a ScholarForge server attachment.
- Only the selected text enters the existing review request after the author explicitly starts a workflow.
- Scanned-image PDF OCR is not included.
- Equations, tables, two-column order, headers, footers, and tracked revisions require author verification.

Release notes: [`docs/releases/v1.1-document-ingestion.md`](docs/releases/v1.1-document-ingestion.md)

## Four writing workflows

| Workflow | Input | Main purpose | Primary output |
| --- | --- | --- | --- |
| **Scientific Translation** | Chinese research text | Preserve values, terminology, evidence strength, and scientific tone | Academic English Translation |
| **Conservative Polishing** | English manuscript text | Improve grammar and academic style without inventing facts | Conservative Revision |
| **Pre-submission Review** | English manuscript text | Audit terminology, language, logic, methods, and readiness | Revision + Evidence |
| **Reviewer Response** | Reviewer comment + author evidence | Draft a formal response without fabricating experiments or locations | Response to Reviewer Draft |

## Four independent Model Studio agents

| Agent | Responsibility |
| --- | --- |
| **Terminology Guardian** | Terminology, abbreviations, units, symbols, naming, and locked terms |
| **Academic Editor** | Translation, polishing, revision, or reviewer-response primary output |
| **Logic Auditor** | Causality, evidence boundaries, claim strength, and response completeness |
| **Method Auditor** | Samples, equipment, parameters, statistics, reproducibility, and author evidence |

A normal run sends four independent `qwen-plus` requests through Alibaba Cloud Model Studio and executes them in parallel with `Promise.all`.

## Runtime architecture

```text
DOCX / PDF
  ↓ browser-side parsing
Mammoth / PDF.js
  ↓ selected section
PaperLens Workspace
  ↓ Next.js POST /api/review
4 × qwen-plus through Alibaba Cloud Model Studio
  ↓
Deterministic Aggregator
  ↓
Primary output + issue evidence + terminology + guardrails + author decisions
```

Key implementation files:

- [`lib/document-ingestion.ts`](lib/document-ingestion.ts) — extraction, section detection, and safe chunking;
- [`components/document-import-dock.tsx`](components/document-import-dock.tsx) — drag-and-drop, preview, selection, and import;
- [`lib/bailian.ts`](lib/bailian.ts) — task-aware agent prompts, calls, and aggregation;
- [`app/api/review/route.ts`](app/api/review/route.ts) — request validation and live/demo routing;
- [`lib/cloud-workspace.ts`](lib/cloud-workspace.ts) — local and Supabase project sync;
- [`supabase/migrations/20260730_cloud_workspace.sql`](supabase/migrations/20260730_cloud_workspace.sql) — project table and RLS.

## Cloud projects and isolation

Supabase email accounts can explicitly sync the current project, migrate all local projects, restore a project on another browser, or delete only the cloud copy.

`public.scholarforge_projects` uses Row Level Security:

```sql
auth.uid() = owner_id
```

Signing in does not automatically upload existing local manuscripts. Guest and local demo sessions remain browser-only.

Setup guide: [`docs/cloud-workspace.md`](docs/cloud-workspace.md)

## Scientific guardrails

ScholarForge OS currently enforces:

- no new numeric values outside source text and author-provided evidence;
- no fabricated experiments, samples, equipment, standards, or references;
- no silent conversion of correlation into causality;
- missing method details remain `[Please provide ...]` author tasks;
- major logic and method risks are not erased by smoother language;
- locked terminology is passed to all four agents and rechecked in the final result.

These safeguards do not replace peer review, statistical review, or reference verification.

## Quick start

Requirements:

- Node.js `>= 22.12`;
- Alibaba Cloud Model Studio API key;
- optional Supabase project.

```bash
git clone https://github.com/liqinglq666/scholarforge-os.git
cd scholarforge-os
npm install
cp .env.example .env.local
```

```env
DASHSCOPE_API_KEY=your_key
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=qwen-plus

NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

To enable cloud projects, run this file in the Supabase SQL editor:

```text
supabase/migrations/20260730_cloud_workspace.sql
```

Validate:

```bash
npm run typecheck
npm run build
```

## Current boundaries

- PDF import supports selectable text, not scanned-image OCR.
- DOCX/PDF import does not reconstruct the original visual page layout.
- Cloud projects keep the latest eight task snapshots, not unlimited versions or attachments.
- Accepting a suggestion records a decision but does not automatically edit the manuscript.
- DOCX Track Changes export is not implemented.
- Agent results arrive after the API response completes; SSE progress is not implemented.

## Roadmap

- safe issue-level apply, undo, and conflict resolution;
- DOCX Track Changes export;
- SSE agent progress;
- optional OCR for scanned PDFs;
- unlimited version history and attachments;
- supervisor, student, and co-author collaboration;
- DOI, citation, and cross-section numeric consistency checks.

## License

Copyright © ScholarForge OS contributors. Review repository licensing information before reuse.
