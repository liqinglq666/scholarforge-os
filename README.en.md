# ScholarForge OS

[简体中文](README.md) · [English](README.en.md)

<p align="center">
  <img src="public/scholarforge-lockup.svg" alt="ScholarForge OS" width="420" />
</p>

<p align="center"><strong>An author-controlled workflow for scientific English revision</strong></p>

ScholarForge OS focuses on three reliable tasks: scientific Chinese-to-English translation, conservative English polishing, and pre-submission review. Suggestions never overwrite the source automatically. Authors inspect and decide on every finding before a safely anchored edit can enter the working manuscript.

## Supported flow

```text
Import DOCX or paste text
→ choose translation, polishing, or pre-submission review
→ run internal specialist checks and aggregate findings
→ accept, defer, or reject each item
→ safely apply selected edits
→ export TXT, Markdown evidence report, or clean DOCX
```

The current release deliberately excludes reviewer-response drafting, PDF parsing, OCR, batch application, native Word tracked changes, developer-oriented result export, accounts, cloud projects, and collaboration. It also does not generate simulated review results when the model service is unavailable.

## Safe editing

An edit may be applied only when the author accepted it, the original and suggestion are complete, the source anchor is unique, the edit remains inside one paragraph, and it does not overlap another applied edit.

There is no batch auto-apply. Terminology, numerical, citation, conclusion, logic, method, and meaning-changing findings must be reviewed individually. Undo and redo remain available for applied edits.

The full suggested manuscript is also checked for numeric consistency. If numeric values are added, removed, or changed, ScholarForge keeps the original text and adds a visible finding for author review.

## Import and export

Browser-side import supports semantic DOCX text, common manuscript-section detection, section preview, paragraph-aware chunking to the 12,000-character task limit, and direct text paste.

PDF and OCR are not supported. Copy the relevant text from a PDF and paste it into the workspace. Complex formulas, tables, floating objects, and original Word page layout are not reconstructed.

Exports include suggested text, a Markdown evidence report, and a clean editable DOCX generated from author-applied edits.

## Service and data boundary

Drafts and the eight most recent review snapshots are stored in browser `localStorage`. Versioned workspace backup and restore remain available. Original DOCX files are not uploaded automatically, and only text deliberately submitted by the author enters the review workflow.

When `DASHSCOPE_API_KEY` is not configured, local editing, saving, history, and export remain available, but analysis requests return an explicit service-configuration error. The application does not substitute fixed examples or simulated findings.

## Stack

Next.js 16, React 19, TypeScript 5.8, Alibaba Cloud Model Studio, Mammoth, docx.js, Vitest, and GitHub Actions.

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

## Verification

```bash
npm audit --omit=dev --audit-level=high
npm run test
npm run typecheck
npm run build
```

## Current limitations

- primary input is limited to 12,000 characters per run;
- import supports DOCX and pasted text only;
- PDF, OCR, reviewer-response drafting, collaboration, and cross-device sync are not supported;
- batch application, native tracked changes, and original-file format fidelity are not provided;
- no simulated analysis is returned when the model service is unavailable;
- authors must still verify scientific facts, statistics, citations, and journal requirements.

## License

Copyright © ScholarForge OS contributors. No default rights to copy, modify, or redistribute are granted without an explicit license.
