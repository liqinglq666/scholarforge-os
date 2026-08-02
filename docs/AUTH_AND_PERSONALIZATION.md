# Accounts and personalization

ScholarForge OS v2.3 separates reusable preferences from unpublished manuscript data.

## What users can customize

- display name, discipline, and academic stage;
- American or British English;
- explanation detail level;
- default review task, section, and journal context;
- up to 30 reusable terminology or preferred-expression rules;
- a manuscript chapter template with up to 12 chapters.

These preferences apply to future tasks and projects. They never silently rewrite existing drafts or projects, and they cannot override deterministic safety rules for numbers, units, citations, evidence boundaries, or invented content.

## Account scope

Authentication is optional. Without Supabase configuration, the application remains fully usable in guest-local mode.

The first account release synchronizes only `UserPreferences`. Manuscript chapters, supervisor feedback, revision text, AI results, and history remain in browser storage. Full project backup remains a separate JSON export.

## Supabase setup

1. Create a Supabase project.
2. Configure email/password authentication and production SMTP as appropriate.
3. Run `supabase/migrations/202608020001_user_preferences.sql`.
4. Set:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

The API stores access and refresh tokens in HttpOnly, SameSite=Lax cookies. The `user_preferences` table has row-level security policies requiring `auth.uid() = user_id` for every operation.

## Deliberately unsupported in v2.3

- automatic manuscript cloud upload;
- project sharing or team permissions;
- arbitrary system prompts;
- automatic merging of conflicting preferences;
- treating account sync as a substitute for complete workspace backups.
