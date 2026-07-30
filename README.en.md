# ScholarForge OS

[简体中文](README.md) | [English](README.en.md)

<p align="center">
  <img src="public/scholarforge-mark.svg" alt="ScholarForge OS mark" width="148" />
</p>

<p align="center">
  <strong>A multi-agent academic English review and submission-readiness workspace for researchers</strong>
</p>

<p align="center">
  Four specialist agents audit terminology, language, logic, and methods in parallel.<br />
  Deterministic code then owns aggregation, scientific guardrails, scoring, and delivery.
</p>

<p align="center">
  <a href="https://scholarforge-os.vercel.app">Live Demo</a> ·
  <a href="https://dcnua2ebj1ej.feishu.cn/wiki/IuKGwEAU9isxlck4V8ec8jJcnpe">Product Documentation</a> ·
  <a href="https://dcnua2ebj1ej.feishu.cn/wiki/JGxewZQa5izFL0kKQMycXkC9n0c">Technical Documentation</a> ·
  <a href="https://scholarforge-os.vercel.app/api/health">Health Check</a>
</p>

<p align="center">
  <img alt="App version v0.3.0" src="https://img.shields.io/badge/app-v0.3.0-2563eb" />
  <img alt="Workflow version v0.2.0" src="https://img.shields.io/badge/workflow-v0.2.0-0f766e" />
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-111827" />
  <img alt="React 19" src="https://img.shields.io/badge/React-19-149eca" />
  <a href="https://github.com/liqinglq666/scholarforge-os/actions/workflows/ci.yml">
    <img alt="CI" src="https://github.com/liqinglq666/scholarforge-os/actions/workflows/ci.yml/badge.svg" />
  </a>
</p>

## Overview

ScholarForge OS turns one-shot paragraph polishing into a traceable specialist review pipeline. Four independent Alibaba Cloud Model Studio agents audit terminology, academic language, scientific logic, and method reporting. Deterministic application code then normalizes their outputs, merges duplicate issues, applies scientific guardrails, calculates submission readiness, and generates downloadable artifacts.

The goal is not to make every sentence more ornate. It is to make academic English review:

- **Specialized** — each issue class has a clearly scoped reviewer
- **Evidence-linked** — issues retain source text, suggestions, rationale, and agent provenance
- **Scientifically conservative** — the system does not invent experiments, values, standards, references, or method details
- **Internally consistent** — score and Reviewer Decision come from the same code rules
- **Auditable and deliverable** — results can be inspected, traced, and exported

> Core principle: **models provide specialist judgment; code owns the final rules.**

## Why ScholarForge OS

General writing assistants can improve grammar and fluency, but research manuscripts also require terminology consistency, evidence boundaries, reproducibility checks, and factual restraint. A single prompt struggles to cover all of these objectives and cannot clearly show which specialist judgment produced a change.

| Research-writing risk | ScholarForge OS response |
| --- | --- |
| Abbreviations, units, materials, or specimen names drift | Terminology Guardian produces terminology issues and normalization suggestions |
| Grammatically correct text still reads unlike academic English | Academic Editor produces a conservative full-text revision |
| Causal or absolute claims exceed the evidence | Logic Auditor flags overstatement, evidence boundaries, and reasoning gaps |
| Sample counts, equipment settings, or data processing are missing | Method Auditor raises reproducibility-oriented author actions |
| Edits are hard to explain or scores conflict with decisions | The aggregator owns the shared schema, weights, score, and Decision |

## Product structure

![ScholarForge OS product structure](docs/readme-assets/product-structure.svg)

The product is organized around one end-to-end workflow:

1. **Review Input** accepts a target journal and 40–12,000 characters of academic text.
2. **Parallel Agent Team** starts four independent model requests.
3. **Evidence Aggregator** normalizes results, removes duplicates, applies guardrails, and scores the review.
4. **Review Workspace** presents text comparison, issues, terminology, and execution traces.
5. **Submission Readiness** produces one score, Reviewer Decision, and rationale.
6. **Deliverables** generate revised text, a Markdown audit report, and structured JSON.

## Four specialist agents

| Agent | Responsibility | Primary output |
| --- | --- | --- |
| **Terminology Guardian** | Abbreviations, terminology, units, symbols, and naming consistency | Terminology issues and preferred forms |
| **Academic Editor** | Grammar, collocation, academic tone, clarity, and readability | Conservative full revision and language issues |
| **Logic Auditor** | Causality, evidence boundaries, reasoning gaps, and overstatement | Logic risks and revision actions |
| **Method Auditor** | Reporting completeness and methodological reproducibility | Missing information and author actions |

Each agent has its own system prompt, request, response, duration, and failure state. The system does not simulate four roles inside one prompt.

## Workflow

1. Enter a target journal and paste an academic passage.
2. Start a full review; the application schedules all four agents with `Promise.all`.
3. Each agent returns independent structured issues and suggestions.
4. The aggregator aligns fields, merges duplicates, and retains agent provenance.
5. Scientific guardrails check new numbers, meaning drift, and treatment of missing method information.
6. Code calculates before/after scores and the Decision from issue type and severity.
7. Review the result in the workspace and download TXT, Markdown, or JSON artifacts.

An individual agent has a 46-second timeout. Its failure does not erase successful outputs from other agents; the review fails only when all four specialists fail.

## Review workspace

![ScholarForge OS review workspace](docs/readme-assets/workspace-preview.svg)

- **Left** — manuscript project, agent-team status, and scientific guardrails
- **Center** — input, source/revision comparison, issue center, terminology, and execution trace
- **Right** — submission readiness, Decision rationale, metrics, and deliverables

The interface supports:

- **Live mode** — calls the configured Alibaba Cloud Model Studio model
- **Demo mode** — uses an explicitly labeled local fixture and does not call an external model
- **Partial-failure state** — preserves successful agent outputs and exposes failure reasons

## Scientific guardrails

ScholarForge OS places scientific meaning ahead of stylistic fluency:

- Never fabricate experiments, sample counts, equipment settings, standards, results, or references
- Never introduce numerical tokens absent from the source passage
- Keep missing information visible as `[Please provide ...]` author actions
- Do not disguise changes to scientific claims as language editing
- Do not allow a model to determine the final score or Reviewer Decision directly
- Do not clear major logic or method issues merely because the language became smoother

These controls reduce obvious risks; they are not a substitute for full fact checking, statistical review, or peer review.

## Technical architecture

![ScholarForge OS system architecture](docs/readme-assets/arch-system.svg)

| Layer | Responsibility |
| --- | --- |
| **Client Layer** | Three-column workspace, interaction state, result views, and browser-side export |
| **Application Layer** | Next.js Route Handlers, validation, health checks, and error responses |
| **Orchestration Layer** | Parallel scheduling, normalization, de-duplication, guardrails, scoring, and Decision |
| **Agent Layer** | Four independent Model Studio OpenAI-compatible requests |
| **Artifact Layer** | TXT, Markdown, and JSON generation |

### Parallel runtime

![ScholarForge OS parallel workflow](docs/readme-assets/workflow-runtime.svg)

- `POST /api/review` runs a demo or live review; the route has a 60-second maximum duration
- `GET /api/health` reports the app version, model configuration state, and selected model
- Manuscript text: 40–12,000 characters
- Target-journal name: up to 160 characters
- Per-agent timeout: 46 seconds
- Default model: `qwen-plus`

### Score and Reviewer Decision

Models identify issues; application code calculates the final score. Major logic and method issues carry more weight than language and terminology findings, and unresolved post-revision issues continue to incur penalties.

| Decision | Deterministic condition |
| --- | --- |
| `Major Revision` | Post-revision score is below 80, or at least two major Logic/Method issues remain |
| `Minor Revision` | Post-revision score is below 92, or any major issue remains |
| `Ready for Submission` | Post-revision score is at least 92 and no major issue remains |

The score is a product decision aid, not an official evaluation from the target journal.

## Current deliverables

| File | Contents |
| --- | --- |
| `Revised_Manuscript.txt` | Conservative revision produced by Academic Editor |
| `Audit_Report.md` | Summary, issues, terminology, execution trace, and Decision |
| `Review_Result.json` | Full structured result, agent runs, and guardrail state |

Files are generated locally with browser `Blob` and Object URLs. The current release does not persist projects in the cloud.

## Technology stack

| Area | Technology |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, native CSS |
| Server | Next.js Route Handlers, Node.js runtime |
| Model platform | Alibaba Cloud Model Studio OpenAI-compatible API |
| Multi-agent scheduling | Parallel `Promise.all` execution |
| File export | Browser Blob and Object URL |
| Deployment | Vercel |
| CI | GitHub Actions, Node.js 22 |

## Quick start

### Requirements

- Node.js 20.9+; Node.js 22 recommended
- npm
- Alibaba Cloud Model Studio API key, optional; without it the app uses demo mode

### 1. Clone and install

```bash
git clone https://github.com/liqinglq666/scholarforge-os.git
cd scholarforge-os
npm install
```

### 2. Configure environment variables

Windows CMD:

```bat
copy .env.example .env.local
```

macOS, Linux, or PowerShell:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
DASHSCOPE_API_KEY=your_api_key
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=qwen-plus
```

| Variable | Required | Description |
| --- | --- | --- |
| `DASHSCOPE_API_KEY` | No | Required for live mode; demo mode is used when absent |
| `DASHSCOPE_BASE_URL` | No | Model Studio OpenAI-compatible API base URL |
| `DASHSCOPE_MODEL` | No | Model name; defaults to `qwen-plus` |

Do not use `NEXT_PUBLIC_DASHSCOPE_API_KEY`; it would expose the key to the browser.

### 3. Run and validate

```bash
npm run dev
```

- App: `http://localhost:3000`
- Health check: `http://localhost:3000/api/health`

```bash
npm run typecheck
npm run build
```

## Deploy to Vercel

1. Import `liqinglq666/scholarforge-os` into Vercel.
2. Keep the Next.js framework preset and root directory `./`.
3. Configure `DASHSCOPE_API_KEY`, `DASHSCOPE_BASE_URL`, and `DASHSCOPE_MODEL`.
4. Deploy and open `/api/health`; verify `modelStudioConfigured: true`.
5. Run one live review from the workspace and check all four agent traces.

## Repository structure

```text
.
├── app/
│   ├── api/
│   │   ├── health/route.ts       # Version and model-configuration health check
│   │   └── review/route.ts       # Multi-agent review API
│   ├── globals.css               # Interface visual system
│   ├── layout.tsx
│   └── page.tsx                  # Three-column review workspace
├── lib/
│   ├── bailian.ts                # Agent calls, aggregation, scoring, and guardrails
│   ├── demo-review.ts            # Deterministic demo result
│   └── types.ts                  # Core data contracts
├── docs/readme-assets/           # README architecture and interface visuals
├── public/scholarforge-mark.svg
├── .github/workflows/ci.yml
├── .env.example
├── package.json
├── README.md
└── README.en.md
```

## Version semantics

- **App `v0.3.0`** — the web application and release version
- **Workflow contract `v0.2.0`** — the review response schema returned by `/api/review`
- **Demo workflow `v0.2.0-demo`** — the contract identifier for the demo fixture

App and workflow versions serve different purposes and are not required to use the same number.

## Current boundaries

- Plain-text input only; PDF and DOCX parsing are not implemented
- No accounts, database, or persistent cloud manuscript projects
- No accept/reject workflow for individual edits
- Only Academic Editor produces the full revised manuscript
- Logic and method actions remain in the issue center instead of being fabricated into the manuscript
- Numerical protection is token-level, not complete factual verification
- Multi-agent execution is bounded by one Vercel function lifecycle
- Live mode sends the submitted text to Alibaba Cloud Model Studio

## Roadmap

### v0.4 — document and project workspace

- PDF/DOCX upload and section parsing
- Manuscript version history and terminology memory
- Accept or reject individual edits
- DOCX Track Changes export

### v0.5 — submission-material workflow

- Response to Reviewers
- Cover Letter, Highlights, and Author Contributions
- Data Availability Statement

### v0.6 — evidence chain and consistency

- Journal-guideline knowledge base
- Citation and DOI verification
- Cross-section terminology, number, and claim consistency

## Documentation

- [ScholarForge OS Product Documentation (Feishu)](https://dcnua2ebj1ej.feishu.cn/wiki/IuKGwEAU9isxlck4V8ec8jJcnpe)
- [ScholarForge OS Technical Documentation (Feishu)](https://dcnua2ebj1ej.feishu.cn/wiki/JGxewZQa5izFL0kKQMycXkC9n0c)

Both documents are configured as read-only for anyone with the link. The product document covers positioning, scenarios, mechanisms, boundaries, and a demo appendix. The technical document covers architecture, data contracts, runtime behavior, rules, deployment, and testing boundaries.

## License

This repository currently has no open-source license. Copying, modification, distribution, or commercial use is not granted by default unless the copyright holder gives explicit permission.
