# ScholarForge OS v1.5 Architecture

## Product boundary

ScholarForge OS is a local-first, evidence-oriented scientific writing workspace. The supported path is:

```text
project setup / document import
→ review API
→ four specialist agents
→ deterministic aggregation
→ evidence queue
→ author decision
→ safe manuscript edit
→ local history and export
```

The current release intentionally excludes account management, cloud synchronization, team collaboration, OCR, and original-OOXML package patching. Those capabilities added disproportionate state, security, and maintenance cost without improving the central evidence-review workflow.

## Runtime modules

### Application shell

- `components/workspace-hub.tsx`: hub/workbench routing and local persistence orchestration.
- `components/project-hub/project-hub.tsx`: compact project center, workflows, recent tasks, backup, and data controls.
- `components/workbench/evidence-workbench.tsx`: review controller plus three-column author workspace.
- `components/document-import-dialog.tsx`: controlled DOCX/PDF parsing and section selection.

### Shared contracts

- `lib/app-config.ts`: application version, storage keys, limits, and user-facing labels.
- `lib/workspace-schema.ts`: draft, snapshot, backup, and runtime guards.
- `lib/workspace-store.ts`: non-destructive local reads and versioned backup operations.
- `lib/evidence-model.ts`: risk classification and restricted batch-apply policy.

### Review engine

- `app/api/review/route.ts`: validates the request and chooses live or demo execution.
- `lib/bailian.ts`: runs terminology, language, logic, and method agents independently and aggregates completed results.
- `lib/demo-review.ts`: deterministic public-safe demonstration data.
- `lib/types.ts`: review-domain contracts.

### Author editing and delivery

- `lib/author-editing.ts`: exact/whitespace anchoring, ambiguity and overlap protection, edit composition.
- `lib/docx-export.ts`: clean and tracked author-working-document export.
- `lib/document-ingestion.ts`: local DOCX/PDF extraction, section detection, and chunking.

## Data model

The project uses the existing v1 storage keys to avoid destructive migration:

- `scholarforge-os-paperlens-draft-v1`
- `scholarforge-os-paperlens-history-v1`
- `scholarforge-os-hub-view-v1`
- `scholarforge-os-author-editing-session-v1`

Reads never silently delete malformed values. The UI falls back to an empty in-memory state and reports a recoverable warning while preserving raw browser data.

Issue decisions remain serialized as `pending`, `accepted`, `deferred`, and `dismissed`.

## Safety policy

A suggestion can enter the working manuscript only when:

1. the author has accepted it;
2. both original and revised text are present and differ;
3. the original has one unique exact or whitespace-normalized anchor;
4. the edit stays within one paragraph;
5. it does not contain an author placeholder;
6. it does not overlap an applied edit.

Batch application is narrower: only accepted, low-risk language suggestions with safe anchors are eligible. Major, logic, method, terminology, numerical, citation, conclusion, and meaning-changing findings require individual review.

## Styling

The UI uses five semantic style layers:

- `tokens.css`
- `base.css`
- `shell.css`
- `workbench.css`
- `responsive.css`

Version-numbered override sheets and global floating docks were removed. The desktop workspace uses three columns; tablet and mobile switch to explicit single-panel navigation instead of squeezing the desktop layout.

## Verification gates

CI runs:

1. dependency installation;
2. production dependency audit;
3. Vitest unit tests;
4. TypeScript checking with unused-code diagnostics;
5. Next.js production build.

Core tests cover version/storage contracts, non-destructive storage reads, evidence risk and batch policy, and safe anchor behavior.
