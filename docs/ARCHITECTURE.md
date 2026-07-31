# ScholarForge OS v1.5 Architecture

## Product boundary

ScholarForge OS is a local-first scientific writing workspace with one supported path:

```text
DOCX import or pasted text
→ translation, polishing, or pre-submission review
→ internal specialist checks
→ deterministic aggregation
→ issue queue
→ individual author decision
→ safe manuscript edit
→ local history and simple export
```

The release intentionally excludes accounts, cloud synchronization, collaboration, reviewer-response drafting, PDF parsing, OCR, batch auto-application, native Word tracked changes, developer result exports, and original-OOXML package patching. It also does not return simulated review results when the model service is unavailable.

## Runtime modules

### Application shell

- `components/workspace-hub.tsx`: home/workspace routing, service-readiness checks, and local persistence orchestration.
- `components/project-hub/project-hub.tsx`: start, resume, recent work, compact data controls, and an actionable service status.
- `components/workbench/evidence-workbench.tsx`: task preparation, issue review, individual decisions, and working manuscript.
- `components/document-import-dialog.tsx`: controlled DOCX parsing and section selection.

### Shared contracts

- `lib/app-config.ts`: version, storage keys, limits, and labels.
- `lib/workspace-schema.ts`: draft, snapshot, backup, and runtime guards.
- `lib/workspace-store.ts`: non-destructive local reads, legacy filtering, result normalization, and backup operations.
- `lib/evidence-model.ts`: evidence risk classification.
- `lib/types.ts`: the stable public review contract; provider telemetry and execution traces are intentionally excluded.

### Review engine

- `app/api/review/route.ts`: validates supported requests, rejects unconfigured service calls with HTTP 503, and returns only author-facing result data.
- `lib/bailian.ts`: runs terminology, language, logic, and method checks internally, aggregates completed results, and blocks full-text output when numeric values change.

There is no demo or fallback-result generator. Missing configuration is reported explicitly instead of returning fixed example output.

### Editing and delivery

- `lib/author-editing.ts`: exact and whitespace-normalized anchoring, ambiguity checks, overlap protection, undo/redo composition.
- `lib/docx-export.ts`: clean author-working-document export only.
- `lib/document-ingestion.ts`: local DOCX extraction, section detection, and paragraph-aware chunking.

## Data model and compatibility

Existing storage keys remain unchanged to avoid destructive migration. Reads never silently delete malformed or unsupported legacy values.

Old reviewer-response drafts are converted to pre-submission review while preserving their source text. Old reviewer-response history and old demo-result history are hidden from the current interface but are not deleted from raw browser storage. Old PDF import metadata is ignored.

Retained snapshots are normalized before use and backup. Retired provider fields such as demo/live mode, workflow version, scores, Agent run records, and implementation telemetry are removed from the normalized result.

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

The full generated manuscript is withheld when its numeric-token signature differs from the source. In that case, the original text is retained and a visible numeric-consistency finding is added for author review.

## Service readiness

`GET /api/health` reports only actionable capability state:

- `ready`: the analysis key is configured;
- `unconfigured`: the application is available, but model analysis is disabled.

A network or route failure is handled by the client as `offline`. Provider model names and internal execution details are not required by the product UI.

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

Core tests cover version/storage contracts, legacy scope filtering, demo-result exclusion, retired metadata cleanup, evidence risk, and safe anchor behavior.
