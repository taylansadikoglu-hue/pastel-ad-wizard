# AGENTS.md

## Cursor Cloud specific instructions

This is a single web app: **RevenuAD Signal**, a TanStack Start (React 19 + Vite 7)
competitive ad-intelligence SaaS backed by a **hosted** Supabase project. There is no
local backend — Supabase URL/anon key are committed in `.env` and hardcoded in
`src/integrations/supabase/client.ts`.

### Commands (see `package.json` scripts)
- Dev server: `npm run dev` (or `bun run dev`) — serves UI + server functions + API routes.
- Build: `npm run build`; Lint: `npm run lint`; Format: `npm run format`.

### Non-obvious notes
- **Dev server port is `8080`** (fixed by `@lovable.dev/vite-tanstack-config` sandbox
  detection), not Vite's usual 5173.
- **Package manager:** the repo's canonical PM is **Bun** (`bunfig.toml`, `bun.lock`), but
  a valid `package-lock.json` is also committed and `npm install` works identically. The
  update script uses `npm install` because npm is preinstalled and bun is not.
- `bunfig.toml` sets a 24h supply-chain guard (`minimumReleaseAge`); irrelevant when using npm.
- **`npm run lint` currently exits non-zero** with ~3.8k pre-existing `prettier/prettier`
  formatting errors across the existing source. This is the repo's baseline, not an
  environment problem. Do not mass-reformat unless asked; `npm run format` would rewrite
  many files.
- Do **not** add tanstackStart/react/tailwind/nitro plugins to `vite.config.ts` — they are
  already bundled by `@lovable.dev/vite-tanstack-config` (see the comment in that file).

### Auth / testing gotchas
- The authenticated app (`src/routes/_authenticated/*`: dashboard, advertisers, advisor,
  etc.) is guarded by a real Supabase session (`_authenticated/route.tsx`). Reaching it
  requires a logged-in user.
- The hosted Supabase project **requires email confirmation** for email/password signup,
  and uses the shared Supabase email service which has a **low hourly rate limit**
  ("email rate limit exceeded" on repeated signups). Without mailbox access you cannot
  confirm a fresh account, so you cannot reach the dashboard via plain email signup.
  To test authenticated flows end-to-end, use a pre-confirmed test account (set its
  credentials as secrets) or a Google OAuth login.
- Full competitor "scan" completion depends on an **external background worker + engine**
  (`api.revenuad.com`, Apify/DataForSEO/AI) that does **not** live in this repo; the app
  only inserts a `pending` row. The UI runs fine without it.
- Server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`, `RESEND_API_KEY`)
  are not committed; only the admin/service-role client and the Resend email webhook need
  them. Core UI + authenticated reads work without them.
