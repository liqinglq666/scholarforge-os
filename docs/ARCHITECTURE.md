# ScholarForge OS v1.5 Architecture

## Product boundary

ScholarForge OS is a local-first scientific writing workspace with one supported path:

```text
DOCX import or pasted text
→ translation, polishing, or pre-submission review
→ four specialist agents
→ deterministic aggregation
→ issue queue
→ individual author decision
→ safe manuscript edit
→ local history and simple export
```

The release intentionally excludes accounts, cloud synchronization, collaboration, reviewer-response drafting, PDF parsing, OCR, batch auto-application, native Word tracked changes, developer result exports, and original-OOXML package patching. These capabilities add substantial state, format-fidelity, or misuse risk without strengthening the stable core workflow.

## Runtime modules

### Application shell

- `components/workspace-hub.tsx`: home/workspace routing and local persistence orchestration.
- `components/project-hub/project-hub.tsx`: start, resume, recent work, and compact data controls.
- `components/workbench/evidence-workbench.tsx`: task preparation, issue review, individual decisions, and working manuscript.
- `components/document-import-dialog.tsx`: controlled DOCX parsing and section selection.

### Shared contracts

- `lib/app-config.ts`: version, storage keys, limits, and labels.
- `lib/workspace-schema.ts`: draft, snapshot, backup, and runtime guards.
- `lib/workspace-store.ts`: non-destructive local reads, legacy filtering, and backup operations.
- `lib/evidence-model.ts`: evidence risk classification.

### Review engine

- `app/api/review/route.ts`: validates supported requests and selects live or demo execution.
- `lib/bailian.ts`: independently runs terminology, language, logic, and method agents, then aggregates completed results.
- `lib/demo-review.ts`: deterministic public-safe demonstration data.
- `lib/types.ts`: review-domain contracts.

### Editing and delivery

- `lib/author-editing.ts`: exact and whitespace-normalized anchoring, ambiguity checks, overlap protection, undo/redo composition.
- `lib/docx-export.ts`: clean author-working-document export only.
- `lib/document-ingestion.ts`: local DOCX extraction, section detection, and chunking.

## Data model and compatibility

Existing storage keys remain unchanged to avoid destructive migration. Reads never silently delete malformed or unsupported legacy values.

Old reviewer-response drafts are converted to pre-submission review while preserving their source text. Old reviewer-response history is hidden from the current interface but is not deleted from raw browser storage. Old PDF import metadata is ignored.

Issue decisions remain serialized as `pending`, `accepted`, `deferred`, and `dismissed`.

## Safety policy

A suggestion enters the working manuscript only when:

1. the author explicitly accepted it;
2. both original and revised text are present and differ;
3. the source has one unique exact or whitespace-normalized anchor;
4. the edit stays within one paragraph;
5. it does not contain an author placeholder;
6. it does not overlap an applied edit.

There is no batch application. Every suggestion is reviewed individually. High-risk scientific findings remain author decisions rather than automated text operations.

## Styling

The UI uses five semantic style layers:

- `tokens.css`
- `base.css`
- `shell.css`
- `workbench.css`
- `responsive.css`

Desktop uses a focused issue/manuscript/suggestion layout. Tablet and mobile switch to explicit single-panel navigation instead of compressing desktop columns.

## Verification gates

CI runs dependency installation, production dependency audit, Vitest tests, strict TypeScript checking, and a Next.js production build.

Core tests cover version/storage contracts, legacy scope filtering, evidence risk, and safe anchor behavior.
