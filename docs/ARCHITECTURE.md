# ScholarForge OS Architecture

```text
Browser workspace
  -> Next.js client interface
  -> POST /api/review
  -> secure server-side Model Studio request
  -> normalized ReviewResult JSON
  -> comparison, issues, terminology, and readiness panels
```

## Runtime modes

- **Live mode:** `DASHSCOPE_API_KEY` is present and the server calls Alibaba Cloud Model Studio.
- **Demo mode:** the key is absent and the server returns a deterministic review, keeping the public demo usable.

## Current boundaries

The MVP reviews pasted manuscript passages. File upload, persistent projects, asynchronous orchestration, and formal document export are planned for later iterations.
