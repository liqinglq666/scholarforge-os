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
  <a href="https://scholarforge-os.vercel.app/login">Sign in / Sign up</a> ·
  <a href="https://dcnua2ebj1ej.feishu.cn/wiki/IuKGwEAU9isxlck4V8ec8jJcnpe">Product Documentation</a> ·
  <a href="https://dcnua2ebj1ej.feishu.cn/wiki/JGxewZQa5izFL0kKQMycXkC9n0c">Technical Documentation</a> ·
  <a href="https://scholarforge-os.vercel.app/api/health">Health Check</a>
</p>

<p align="center">
  <img alt="App version v0.5.0" src="https://img.shields.io/badge/app-v0.5.0-2563eb" />
  <img alt="Workflow version v0.2.0" src="https://img.shields.io/badge/workflow-v0.2.0-0f766e" />
  <img alt="Alibaba Cloud Model Studio" src="https://img.shields.io/badge/Alibaba%20Cloud-Model%20Studio-ff6a00" />
  <img alt="Supabase Auth" src="https://img.shields.io/badge/auth-Supabase-3ecf8e" />
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-111827" />
  <a href="https://github.com/liqinglq666/scholarforge-os/actions/workflows/ci.yml">
    <img alt="CI" src="https://github.com/liqinglq666/scholarforge-os/actions/workflows/ci.yml/badge.svg" />
  </a>
</p>

## Overview

ScholarForge OS turns one-shot paragraph polishing into a traceable specialist review pipeline. Four independent Alibaba Cloud Model Studio agents audit terminology, academic language, scientific logic, and method reporting. Deterministic application code then normalizes their outputs, merges duplicate issues, applies scientific guardrails, calculates submission readiness, and generates downloadable artifacts.

The goal is not to make every sentence more ornate. It is to make academic English review:

- **Specialized** — each issue class has a clearly scoped reviewer;
- **Evidence-linked** — issues retain source text, suggestions, rationale, and agent provenance;
- **Scientifically conservative** — the system does not invent experiments, values, standards, references, or method details;
- **Internally consistent** — score and Reviewer Decision come from the same code rules;
- **Auditable and deliverable** — results can be inspected, traced, and exported;
- **Low-friction to evaluate** — public visitors can continue as guests instead of being forced to register.

> Core principle: **models provide specialist judgment; code owns the final rules.**

## Product workflow

![ScholarForge OS product structure](docs/readme-assets/product-structure.svg)

1. **Account Access** — use a Supabase account, a clearly labeled local demo account, or guest mode.
2. **Review Input** — enter a target journal and 40–12,000 characters of academic text.
3. **Parallel Agent Team** — start four independent Model Studio requests.
4. **Evidence Aggregator** — normalize outputs, remove duplicates, apply guardrails, and score the review.
5. **Review Workspace** — inspect source/revision comparison, author actions, issues, terminology, and execution traces.
6. **Submission Readiness** — receive one score, Reviewer Decision, and deterministic rationale.
7. **Deliverables** — download revised text, a Markdown audit report, and structured JSON evidence.

## Four specialist agents

| Agent | Responsibility | Primary output |
| --- | --- | --- |
| **Terminology Guardian** | Abbreviations, terminology, units, symbols, and naming consistency | Terminology issues and preferred forms |
| **Academic Editor** | Grammar, collocation, academic tone, clarity, and readability | Conservative full revision and language issues |
| **Logic Auditor** | Causality, evidence boundaries, reasoning gaps, and overstatement | Logic risks and revision actions |
| **Method Auditor** | Reporting completeness and methodological reproducibility | Missing information and author actions |

Each agent has its own system prompt, request, response, duration, and failure state. The system does not simulate four roles inside one prompt.

## Review workspace

![ScholarForge OS review workspace](docs/readme-assets/workspace-preview.svg)

- **Left** — current project, draft state, specialist status, and scientific guardrails;
- **Center** — manuscript input, comparison, author actions, issue center, terminology, and execution trace;
- **Right** — submission readiness, Decision rationale, risk profile, and deliverables;
- **Mobile** — page-level navigation for input, results, issues, and export instead of a long stacked desktop layout.

The workspace includes:

- browser-local draft autosave;
- issue search and specialist/severity filters;
- expand/collapse controls for evidence cards;
- an author-action checklist for major logic, method, and `[Please provide ...]` items;
- explicit live, demo, partial-failure, and retry states;
- TXT, Markdown, and JSON downloads.

## Accounts and authentication

v0.5 adds a dedicated sign-in/sign-up experience and an account control integrated into the workspace top bar. Public guest access remains available so the competition demo is not blocked by mandatory registration.

| Mode | Purpose | Current storage |
| --- | --- | --- |
| **Supabase cloud account** | Real email/password sign-up, sign-in, email confirmation, password reset, and session persistence | Supabase Auth |
| **Local demo account** | Exercises account UX when Supabase is not configured; passwords are not uploaded or stored | Current browser |
| **Guest mode** | Immediate public evaluation without registration | Current browser |

The current account layer manages identity and sessions only. It does **not** yet provide per-user cloud manuscript projects. Drafts remain browser-local, and `/api/review` remains anonymously callable for the public competition demo.

See [Authentication architecture and setup](docs/authentication.md).

## Alibaba Cloud Model Studio integration

ScholarForge OS uses Alibaba Cloud Model Studio for its core review capability.

- Default model: `qwen-plus`;
- API: DashScope OpenAI-compatible endpoint;
- Execution location: Next.js server runtime;
- One full review: normally four independent model requests;
- API key: server-side only and never exposed to the browser.

```text
Browser
  ↓
Next.js POST /api/review
  ↓
4 independent specialist requests
  ↓
Alibaba Cloud Model Studio · qwen-plus
  ↓
Deterministic Aggregator
  ↓
Review workspace + downloadable artifacts
```

Key implementation files:

- [`lib/bailian.ts`](lib/bailian.ts) — prompts, Model Studio calls, normalization, de-duplication, guardrails, and scoring;
- [`app/api/review/route.ts`](app/api/review/route.ts) — validation, demo/live routing, and error boundaries;
- [`app/api/health/route.ts`](app/api/health/route.ts) — Model Studio and authentication readiness;
- [`.env.example`](.env.example) — Model Studio and Supabase environment variables.

## Scientific guardrails

ScholarForge OS places scientific meaning ahead of stylistic fluency:

- never fabricate experiments, sample counts, equipment settings, standards, results, or references;
- never introduce numerical tokens absent from the source passage;
- keep missing information visible as `[Please provide ...]` author actions;
- do not disguise changes to scientific claims as language editing;
- do not allow a model to determine the final score or Reviewer Decision directly;
- do not clear major logic or method issues merely because the language became smoother.

These controls reduce obvious risks; they are not a substitute for full fact checking, statistical review, or peer review.

## Technical architecture

![ScholarForge OS system architecture](docs/readme-assets/arch-system.svg)

| Layer | Responsibility |
| --- | --- |
| **Identity Layer** | Supabase Auth, guest mode, local demo sessions, and account-state presentation |
| **Client Layer** | Responsive workspace, draft autosave, issue management, result views, and browser-side export |
| **Application Layer** | Next.js Route Handlers, validation, health checks, and error responses |
| **Orchestration Layer** | Parallel scheduling, normalization, de-duplication, guardrails, scoring, and Decision |
| **Agent Layer** | Four independent Model Studio OpenAI-compatible requests |
| **Artifact Layer** | TXT, Markdown, and JSON generation |

### Runtime

![ScholarForge OS parallel workflow](docs/readme-assets/workflow-runtime.svg)

- `POST /api/review` runs a demo or live review with a 60-second route limit;
- `GET /api/health` reports application, model, and authentication configuration;
- manuscript text: 40–12,000 characters;
- target-journal name: up to 160 characters;
- per-agent timeout: 46 seconds;
- default model: `qwen-plus`.

### Score and Reviewer Decision

Models identify issues; application code calculates the final score.

| Decision | Deterministic condition |
| --- | --- |
| `Major Revision` | Post-revision score is below 80, or at least two major Logic/Method issues remain |
| `Minor Revision` | Post-revision score is below 92, or any major issue remains |
| `Ready for Submission` | Post-revision score is at least 92 and no major issue remains |

The score is a product decision aid, not an official evaluation from the target journal.

## Technology stack

| Area | Technology |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, native CSS |
| Authentication | Optional Supabase Auth plus browser-local demo/guest sessions |
| Server | Next.js Route Handlers, Node.js runtime |
| Model platform | Alibaba Cloud Model Studio OpenAI-compatible API |
| Multi-agent scheduling | Parallel `Promise.all` execution |
| File export | Browser Blob and Object URL |
| Deployment | Vercel |
| CI | GitHub Actions, Node.js 22 |

## Quick start

### Requirements

- Node.js 22.12+;
- npm;
- Alibaba Cloud Model Studio API key, optional; demo review mode is used when absent;
- Supabase project, optional; clearly labeled local account mode is used when absent.

### 1. Clone and install

```bash
git clone https://github.com/liqinglq666/scholarforge-os.git
cd scholarforge-os
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Windows CMD:

```bat
copy .env.example .env.local
```

Edit `.env.local`:

```env
DASHSCOPE_API_KEY=your_api_key
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=qwen-plus

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

Do not use `NEXT_PUBLIC_DASHSCOPE_API_KEY`; that would expose the Model Studio key to the browser.

### 3. Run and validate

```bash
npm run dev
npm run typecheck
npm run build
```

- App: `http://localhost:3000`
- Login: `http://localhost:3000/login`
- Health check: `http://localhost:3000/api/health`

## Deploy to Vercel

1. Import `liqinglq666/scholarforge-os` into Vercel.
2. Configure the three `DASHSCOPE_*` variables for live Model Studio reviews.
3. Configure the two `NEXT_PUBLIC_SUPABASE_*` variables for real cloud authentication.
4. Add `https://scholarforge-os.vercel.app/login` to Supabase redirect URLs.
5. Verify `modelStudioConfigured` and, when applicable, `authConfigured` through `/api/health`.
6. Test sign-up, sign-in, sign-out, guest access, one live review, and all three downloads.

## Repository structure

```text
.
├── app/
│   ├── api/health/route.ts       # Model Studio and auth readiness
│   ├── api/review/route.ts       # Multi-agent review API
│   ├── login/page.tsx            # Sign-in, sign-up, and guest access
│   ├── auth.css                  # Authentication visual system
│   ├── auth-inline.css           # Topbar account integration
│   ├── v04.css                   # Review workspace visual system
│   ├── layout.tsx
│   └── page.tsx                  # Review workspace
├── components/
│   ├── auth-provider.tsx         # Auth state and actions
│   └── account-dock.tsx          # Global account control
├── lib/
│   ├── supabase/client.ts        # Optional Supabase browser client
│   ├── bailian.ts                # Agent calls, aggregation, scoring, and guardrails
│   ├── demo-review.ts            # Deterministic demo result
│   └── types.ts                  # Core data contracts
├── docs/authentication.md
├── .env.example
├── package.json
├── README.md
└── README.en.md
```

## Version semantics

- **App `v0.5.0`** — authentication entry, guest mode, and the v0.4 review-workspace capabilities;
- **Workflow contract `v0.2.0`** — the review response schema returned by `/api/review`;
- **Demo workflow `v0.2.0-demo`** — the deterministic demo contract.

## Current boundaries

- plain-text input only; PDF and DOCX parsing are not implemented;
- account sessions exist, but per-user cloud manuscript projects do not;
- drafts remain in browser localStorage;
- `/api/review` is still publicly callable for the competition demo and is not yet protected by server-side auth;
- no accept/reject workflow for individual edits;
- only Academic Editor produces the full revised manuscript;
- numerical protection is token-level, not complete factual verification;
- live mode sends the submitted text to Alibaba Cloud Model Studio.

## Roadmap

### v0.6 — cloud manuscript projects

- Supabase profiles, projects, manuscript versions, and review runs;
- Row Level Security and per-user data isolation;
- anonymous-draft migration and server-side JWT verification;
- review and version history.

### v0.7 — document review and decisions

- PDF/DOCX upload and section parsing;
- accept, reject, or defer individual changes;
- DOCX Track Changes export;
- terminology memory across versions.

### v0.8 — submission materials and evidence chain

- Response to Reviewers;
- Cover Letter, Highlights, and Author Contributions;
- journal-guideline knowledge base;
- citation, DOI, and cross-section consistency checks.

## Documentation

- [ScholarForge OS Product Documentation (Feishu)](https://dcnua2ebj1ej.feishu.cn/wiki/IuKGwEAU9isxlck4V8ec8jJcnpe)
- [ScholarForge OS Technical Documentation (Feishu)](https://dcnua2ebj1ej.feishu.cn/wiki/JGxewZQa5izFL0kKQMycXkC9n0c)
- [Authentication architecture and setup](docs/authentication.md)

## License

This repository currently has no open-source license. Copying, modification, distribution, or commercial use is not granted by default unless the copyright holder gives explicit permission.
