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
- Build: `bun run build` (Cloudflare/Nitro target) or `bun run build:dev`.
- Lint: `bun run lint` (ESLint flat config). NOTE: the committed code currently has
  thousands of pre-existing `prettier/prettier` formatting violations, so `bun run lint`
  exits non-zero on a clean checkout. That is the repo's baseline, not an env problem.
  `bun run format` (prettier --write) is what reformats.
- There is **no automated test suite** (no test runner/scripts configured).

### Auth gotcha (important for end-to-end testing)
- Supabase has `mailer_autoconfirm = false`, so new email/password signups require clicking
  a confirmation link emailed to the user. The shared/built-in Supabase email sender is
  heavily rate-limited (`over_email_send_rate_limit`), which can block creating fresh
  accounts. To exercise the authenticated app you generally need either a pre-confirmed
  test account or `SUPABASE_SERVICE_ROLE_KEY` (to create/confirm a user via the admin API).
- After login, the workspace is paywalled. The paywall has a **"Continue to demo"** button
  that sets `localStorage.revenuead_demo_unlocked = "1"` and routes to `/app/dashboard`,
  unlocking the dashboards without Stripe. Use this for demos.
- Admin email is `hello@revenuad.com`; it gets a dashboard picker instead of auto-redirect.

### Config / env
- `.env` (committed) holds the public Supabase URL + anon key and `VITE_ENGINE_URL`
  (`https://api.revenuad.com`). The engine `/health` endpoint returns 200.
- Server-only secrets (not in `.env`) used by server functions / webhooks:
  `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`, `RESEND_API_KEY`. These are only needed
  for the scan-ready email webhook and admin operations, not for booting the dev server.
