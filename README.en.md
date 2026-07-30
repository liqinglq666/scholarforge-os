# ScholarForge OS

[简体中文](README.md) | [English](README.en.md)

<p align="center">
  <img src="public/scholarforge-lockup.svg" alt="ScholarForge OS logo" width="440" />
</p>

<p align="center">
  <strong>A Model Studio-powered multi-agent workspace for scientific English</strong>
</p>

<p align="center">
  Scientific translation, conservative polishing, pre-submission review, and reviewer responses,<br />
  with shared terminology locks, scientific guardrails, issue evidence, and author decisions.
</p>

<p align="center">
  <a href="https://scholarforge-os.vercel.app">Live Demo</a> ·
  <a href="https://scholarforge-os.vercel.app/login">Sign in / Sign up</a> ·
  <a href="https://scholarforge-os.vercel.app/api/health">Health Check</a> ·
  <a href="https://github.com/liqinglq666/scholarforge-os">GitHub</a>
</p>

<p align="center">
  <img alt="App v0.8.0" src="https://img.shields.io/badge/app-v0.8.0-2563eb" />
  <img alt="Workflow v0.8.0" src="https://img.shields.io/badge/workflow-v0.8.0-0f766e" />
  <img alt="Alibaba Cloud Model Studio" src="https://img.shields.io/badge/Alibaba%20Cloud-Model%20Studio-ff6a00" />
  <img alt="qwen-plus" src="https://img.shields.io/badge/model-qwen--plus-7c3aed" />
  <a href="https://github.com/liqinglq666/scholarforge-os/actions/workflows/ci.yml">
    <img alt="CI" src="https://github.com/liqinglq666/scholarforge-os/actions/workflows/ci.yml/badge.svg" />
  </a>
</p>

---

## Overview

ScholarForge OS is a scientific-English workflow system for graduate students, researchers, supervisors, and academic editors.

Version 0.8 brings the most useful capabilities from the earlier Miaoda prototype, “PaperLens / 研语科研英语 Agent,” into a public and reproducible GitHub implementation:

- Chinese-to-academic-English translation;
- conservative English polishing;
- reviewer-style pre-submission checks;
- evidence-bounded Response to Reviewers drafting;
- user-defined terminology locks;
- numerical and scientific-meaning guardrails;
- split, clean, and highlighted-diff output views;
- issue evidence and author decisions;
- local workflow history;
- TXT, Markdown, and JSON deliverables.

The core principle is:

> **Models provide specialist judgement; deterministic code owns rules, guardrails, scoring, and final state.**

## Four workflows

| Workflow | Input | Purpose | Primary output |
| --- | --- | --- | --- |
| **Scientific translation** | Chinese scientific prose | Preserve facts, terminology, and claim strength in academic English | Academic English translation |
| **Conservative polishing** | English manuscript text | Improve grammar, collocation, tone, tense, voice, and clarity | Conservative revision |
| **Pre-submission precheck** | Submission-ready English draft | Audit terminology, language, logic, methods, and readiness | Precheck revision and evidence |
| **Reviewer-response assistant** | Reviewer comment and author evidence | Draft a professional answer without inventing experiments or manuscript changes | Response to Reviewer draft |

All workflows share:

- seven manuscript-section profiles;
- conservative, balanced, and deep modes;
- four independent Model Studio agents;
- terminology locks;
- deterministic scientific guardrails;
- author issue decisions;
- local history and exports.

## Four specialist agents

| Agent | Responsibility |
| --- | --- |
| **Terminology Guardian** | Terminology mapping, abbreviations, units, nomenclature, and user-locked expressions |
| **Academic Editor** | Complete translation, revision, precheck output, or reviewer-response draft |
| **Logic Auditor** | Claim scope, causality, evidence boundaries, and response completeness |
| **Method Auditor** | Reproducibility, experimental reporting, and author-supplied response evidence |

Each agent has its own system prompt, request, response, duration, issue count, and failure state. The interface does not simulate four agents from a single model answer.

## Alibaba Cloud Model Studio integration

- Default model: `qwen-plus`;
- API: DashScope OpenAI-compatible endpoint;
- Runtime: Next.js server route;
- Normal workflow: four independent model requests per run;
- Orchestration: `Promise.all`;
- API key: server-side environment variable only.

```text
Browser
  ↓
POST /api/review
  ↓
Task Router
  ├─ Translation
  ├─ Polishing
  ├─ Precheck
  └─ Reviewer Response
  ↓
4 independent qwen-plus specialists
  ↓
Deterministic Aggregator + Guardrails
  ↓
Primary output + Evidence + Decisions + Artifacts
```

Key implementation files:

- [`lib/bailian.ts`](lib/bailian.ts) — task-aware prompts, Model Studio calls, aggregation, scoring, and guardrails;
- [`app/api/review/route.ts`](app/api/review/route.ts) — validation, terminology sanitisation, live/demo routing;
- [`components/paperlens-workspace.tsx`](components/paperlens-workspace.tsx) — workflow UI, diff, fact protection, decisions, and local history;
- [`lib/types.ts`](lib/types.ts) — typed contracts;
- [`app/api/health/route.ts`](app/api/health/route.ts) — workflow and configuration status.

## Terminology locks

A user can define up to 12 task-level terminology rules:

```text
Source or trigger expression
→ Required output expression
→ Optional note
```

Terminology locks are:

- sent to all four agents;
- merged into the terminology profile;
- checked by a deterministic guardrail;
- displayed in the fact-protection view;
- stored with local workflow snapshots.

## Scientific guardrails

Current guardrails include:

1. no invented experiments, sample counts, equipment parameters, standards, results, or references;
2. no new numerical tokens outside the primary input or author-supplied context;
3. no silent conversion of association into causation;
4. missing information remains visible as `[Please provide ...]`;
5. reviewer responses may only use author-supplied evidence and manuscript changes;
6. user-locked terminology must be preserved;
7. page and line numbers must not be guessed;
8. models do not directly decide scores or readiness states.

These checks reduce obvious risks but do not replace literature verification, statistical review, or peer review.

## Output views

The primary output supports:

- **Split view** — source and output side by side;
- **Clean output** — focused reading and copying;
- **Highlighted diff** — additions, replacements, and removals.

Large inputs fall back to block highlighting to avoid expensive browser-side token comparisons.

## Author decisions

Each issue can be marked:

```text
Pending
├─ Accepted
├─ Deferred
└─ Dismissed
```

Decisions are included in filters, local snapshots, Markdown reports, decision logs, and JSON exports.

Accepting an issue currently records the author's judgement; it does not yet apply the local edit to the working manuscript. Reliable text anchoring, conflicts, undo, and redo are planned work.

## Authentication and access

The application uses a login-first flow and supports:

- Supabase email authentication when configured;
- an explicitly labelled local demo account;
- a guest entry for public competition evaluation.

Authentication currently manages identity and session state only. Manuscript tasks and history are still stored in browser `localStorage` and are not yet isolated cloud projects.

## Deliverables

| Artifact | Content |
| --- | --- |
| `*-translation.txt`, `*-revision.txt`, or `*-reviewer-response.txt` | Primary workflow output |
| `*-evidence-report.md` | Workflow metadata, guardrails, issues, traces, and decisions |
| `*-author-decisions.md` | Author decision log |
| `*-workflow-result.json` | Complete structured workflow data |

Artifacts are generated in the browser using Blob and Object URLs. The UI does not advertise fake DOCX or PDF downloads.

## Technology

| Area | Stack |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, native CSS |
| Authentication | Optional Supabase Auth, local guest/demo sessions |
| Server | Next.js Route Handlers, Node.js runtime |
| Model platform | Alibaba Cloud Model Studio OpenAI-compatible API |
| Agent orchestration | `Promise.all` |
| Local state | `localStorage` |
| Export | Browser Blob and Object URL |
| Deployment | Vercel |
| CI | GitHub Actions, Node.js 22 |

## Quick start

Requirements:

- Node.js 22.12+;
- npm;
- optional Model Studio API key;
- optional Supabase project.

```bash
git clone https://github.com/liqinglq666/scholarforge-os.git
cd scholarforge-os
npm install
cp .env.example .env.local
npm run dev
```

Environment variables:

```env
DASHSCOPE_API_KEY=your_model_studio_api_key
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=qwen-plus

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

Never expose the Model Studio key through a `NEXT_PUBLIC_` variable.

Validation:

```bash
npm run typecheck
npm run build
```

## Current boundaries

- Text input only; no DOCX/PDF parsing yet;
- reviewer responses currently handle one comment at a time;
- accepted suggestions are not yet applied to a working document;
- local history does not sync across devices;
- authentication exists, but cloud manuscript projects and RLS are not implemented;
- `/api/review` remains callable for the public demo and has no user quota yet;
- numerical protection is token-based, not full fact verification;
- live runs send the input and author context to Alibaba Cloud Model Studio;
- no DOCX Track Changes or formal PDF report yet.

## Roadmap

### P0 — real manuscript workflow

- DOCX/PDF upload and section extraction;
- Supabase projects, versions, review runs, decisions, and RLS;
- apply accepted suggestions with undo and conflict handling;
- version history;
- DOCX Track Changes;
- SSE agent progress.

### P1 — submission and revision studio

- automatic reviewer-comment parsing;
- multi-reviewer response workspace;
- cover letters and highlights;
- author contribution and data statements;
- submission checklist.

### P2 — evidence centre

- journal-guideline knowledge base;
- DOI and citation validation;
- cross-section terminology and number consistency;
- claim–data–figure–reference mapping;
- reusable team terminology profiles.

## License

No open-source licence is currently included. No permission to copy, modify, distribute, or commercially use the repository is granted by default.
