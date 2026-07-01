# Supabase migrations

Project: `exnngwyhogwltpbjcmyl` (see `supabase/config.toml`).

## Daily workflow

```bash
cd /path/to/pastel-ad-wizard
supabase link --project-ref exnngwyhogwltpbjcmyl   # once per machine

# New schema change
supabase migration new describe_the_change
# edit supabase/migrations/<timestamp>_describe_the_change.sql
supabase db push
```

**Always create migration files with `supabase migration new` on the same machine you push from.** Applying SQL in the dashboard first, then adding files later, causes timestamp drift (ghost remote IDs ~2s off from local filenames).

## Recent migrations

| File | Purpose |
|------|---------|
| `20260701000000_canonical_placement_dedup.sql` | `canonical_fingerprint`, `placement_sources`, deduped `normalized_ad_placements` view, `data_quality_runs` |

After push, backfill fingerprints:

```bash
npm run data-quality:merge-dupes -- --domain commbank.com.au --dry-run
npm run data-quality:merge-dupes -- --domain commbank.com.au
npm run data-quality:backfill -- --limit 5000
npm run data-quality:audit -- --domain commbank.com.au --save
```


```bash
supabase migration list
```

Local and remote columns should match for every row.

## Repair drift (history only — no SQL re-run)

If remote has ghost timestamps or schema was applied manually:

```bash
# Remove ghost remote entry
supabase migration repair --status reverted <remote-id>

# Mark local file as already applied (schema exists)
supabase migration repair --status applied <local-id>
```

Then `supabase db push` applies only genuinely new files.

## Current state (after repair)

21 migrations synced through `20260629150000`. One migration still pending on remote:

| Migration | What it does |
|-----------|----------------|
| `20260630120000_email_suppressions.sql` | `email_suppressions` + `email_events` for Resend bounce/complaint webhook |

```bash
supabase db push
```

Verify in Table Editor: `email_suppressions`, `email_events`.

## Regenerate TypeScript types (optional)

After pushing, update `src/integrations/supabase/types.ts`:

```bash
supabase gen types typescript --project-id exnngwyhogwltpbjcmyl > src/integrations/supabase/types.ts
```

Or add table types manually when CLI is unavailable.

## Do not

- Create tables manually in Table Editor for production schema
- Edit `schema_migrations` by hand in SQL Editor
- Rename migration files after they have been applied on any environment
