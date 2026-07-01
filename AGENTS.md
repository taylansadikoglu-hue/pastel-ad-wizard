# AGENTS.md

## Cursor Cloud specific instructions

### What this is
RevenuAD Signal ("R-AD") — a single-product TanStack Start (React 19 + Vite 7) app that
gives marketing agencies competitor ad-spend intelligence. There is no local backend in
this repo: it talks to **hosted** services (Supabase Auth/Postgres, the `api.revenuad.com`
"engine" API, Resend, Stripe). So "running the app" = running the local Vite dev server;
the backends are remote.

### Package manager
- The project uses **Bun** (`bun.lock`, `bunfig.toml`). Bun is installed at `~/.bun/bin/bun`
  and is what the update script refreshes deps with. A `package-lock.json` also exists, so
  `npm install` / `npm run <script>` work as a fallback if Bun is ever unavailable.
- Note: Bun is NOT on `PATH` in non-interactive shells. Use `~/.bun/bin/bun` (or add
  `export PATH="$HOME/.bun/bin:$PATH"` in your shell) when invoking it directly.
- `bunfig.toml` sets a 24h supply-chain guard (`minimumReleaseAge`); this can make `bun add`
  of a just-published version appear to "skip". This does not affect installing the existing
  lockfile.

### Run / lint / build / test
Scripts live in `package.json`:
- Dev server: `bun run dev` (Vite). Binds to **http://localhost:8080** (port comes from
  `@lovable.dev/vite-tanstack-config` sandbox detection, not from repo config).
- **IMPORTANT — server functions need `.env` exported into `process.env`.** TanStack Start
  server functions / middleware (`startScan`, `saveProfile`, the integrations functions,
  the auth middleware) read **non-`VITE_` vars** like `process.env.SUPABASE_URL` and
  `process.env.SUPABASE_PUBLISHABLE_KEY`. Vite/`bun run dev` does NOT auto-load `.env` into
  the server process for non-`VITE_` keys, so a plain `bun run dev` makes those functions
  throw `Missing Supabase environment variable(s)` (e.g. onboarding shows "Couldn't kick
  off scans"). Start the dev server with the env exported, e.g.:
  `set -a && . ./.env && set +a && bun run dev`
  (The `VITE_*` keys are injected into the browser regardless; only the server side needs this.)
- Build: `bun run build` (Cloudflare/Nitro target) or `bun run build:dev`.
- Lint: `bun run lint` (ESLint flat config). NOTE: the committed code currently has
  thousands of pre-existing `prettier/prettier` formatting violations, so `bun run lint`
  exits non-zero on a clean checkout. That is the repo's baseline, not an env problem.
  `bun run format` (prettier --write) is what reformats.
- There is **no automated test suite** (no test runner/scripts configured).

### Auth gotcha (important for end-to-end testing)
- Supabase has `mailer_autoconfirm = false`, so new email/password signups require clicking
  a confirmation link emailed to the user, and the shared/built-in Supabase email sender is
  heavily rate-limited (`over_email_send_rate_limit`). **Skip email entirely** — provision a
  pre-confirmed user with the **service-role key** (`SUPABASE_SERVICE_ROLE_KEY`, available as
  a Cloud secret / `process.env`), then sign in with password:
  ```bash
  # 1) create a confirmed user (email_confirm:true bypasses the email step)
  curl -s -X POST "$SUPABASE_URL/auth/v1/admin/users" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d '{"email":"agent@example.com","password":"DevPass12345!","email_confirm":true}'
  # 2) get a session token (use the anon/publishable key here, not the service role key)
  curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
    -H "apikey: $SUPABASE_PUBLISHABLE_KEY" -H "Content-Type: application/json" \
    -d '{"email":"agent@example.com","password":"DevPass12345!"}'
  ```
  Then log in through the UI at `/auth` with the same email/password. (`SUPABASE_URL` /
  `SUPABASE_PUBLISHABLE_KEY` come from `.env`; the service-role key is injected as a secret.)
- After login, the workspace is paywalled. The paywall has a **"Continue to demo"** button
  that sets `localStorage.revenuead_demo_unlocked = "1"` and routes to `/app/dashboard`,
  unlocking the dashboards without Stripe. Use this for demos.
- The **"start a scan" core action** is only reachable via the onboarding wizard at `/app`
  (it calls the `startScan` server fn, inserting a `pending` row into `domain_scans`). After
  demo-unlock, navigate to `/app` (not `/app/dashboard`) to get the wizard for a brand-new
  user (one with no `agency_domain` on their `profiles` row). Completing it fires real
  `domain_scans` inserts; a background worker (external, not in this repo) advances them
  `pending → running → done`.
- Admin email is `hello@revenuad.com`; it gets a dashboard picker instead of auto-redirect.

### Config / env
- `.env` (committed) holds the public Supabase URL + anon key and `VITE_ENGINE_URL`
  (`https://api.revenuad.com`). The engine `/health` endpoint returns 200.
- Server-only secrets (not in `.env`) used by server functions / webhooks:
  `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`, `RESEND_API_KEY`. These are only needed
  for the scan-ready email webhook and admin operations, not for booting the dev server.
