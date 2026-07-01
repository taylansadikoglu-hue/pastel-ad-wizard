# RevenuAD Signal — Media beta tester guide

**For agency strategists, planners, and media leads evaluating RevenuAD before a client pitch.**

---

## Sign in

| | |
|---|---|
| **URL** | https://revenuad.com/auth |
| **Email** | `beta@revenuad.com` |
| **Password** | `RevenueAdBeta2026!` |

Or click **“Explore live demo (CommBank + Woolworths)”** on the sign-in page.

This is a **shared read-only showcase** — same login for all beta testers. Do not change the password.

---

## What you’re looking at

RevenuAD Signal is **observed competitive ad intelligence** for agency pitches: real creatives, spend signals, market structure, and strategist-ready exports — not a generic AI chat.

The demo is scoped to two Australian showcase advertisers:

| Brand | Category | War room |
|-------|----------|----------|
| **CommBank** | Banking | `/app/advertiser/commbank.com.au` |
| **Woolworths** | Retail | `/app/advertiser/woolworths.com.au` |

You’ll see a gold banner: *“This is a live demo environment…”* — that’s expected.

---

## 15-minute walkthrough (do this in order)

**Pre-flight:** on the server or CI with Supabase secrets:

```bash
npm run beta:smoke-test
```

All checks green before you send invites.

### 1. CommBank War Room (~5 min)

1. Sign in → sidebar **CommBank War Room**
2. Scroll the **above-the-fold** summary: spend, channels, creative volume
3. Open **Market Intel** (strategist dashboard) — try view toggles: **Essentials** vs **Meeting** vs **Full**
4. Pick one **live creative** — check quick-scan metrics (impressions, target demo, CTA, CPC if shown)
5. Try **Export PPTX** (if enabled in your session) — does the deck match what you’d take into a client meeting?

### 2. Woolworths War Room (~5 min)

1. Sidebar → **Woolworths War Room**
2. Compare **retail vs banking** positioning — category leaders, channel mix, creative themes
3. Open **Categories** from the nav — browse **Retail** heatmap / leaderboard
4. Ask yourself: *“Could I walk into a Woolies or Coles pitch with this?”*

### 3. Pitch framing (~5 min)

1. Imagine your **actual client** (not CommBank/Woolworths)
2. Note what you’d need RevenuAD to show for *them*: competitors, retailers, categories, spend proof
3. Note what’s **missing or wrong** for your workflow

---

## What we want you to tell us

Reply to whoever sent you this invite (or email hello@revenuad.com). Honest blunt feedback beats politeness.

### Must-answer (pick any that apply)

1. **First impression (10 sec):** Does this look like pitch-ready intelligence or “another dashboard”?
2. **Trust:** Which numbers or creatives felt credible? Which felt thin or wrong?
3. **War room:** What would you change on the advertiser page before showing a client?
4. **Market Intel:** Essentials vs Full — which view would you actually use in a meeting?
5. **Export:** Would you send the PPTX as-is? What’s missing (slide, proof, narrative)?
6. **Vs your stack:** How does this compare to SimilarWeb, Pathmatics, Magic Brief, manual desk research?
7. **Buyer:** Who in your agency would pay for this — strategy, pitch, new business, performance?
8. **Deal-breaker:** What would stop you recommending it?

### Nice-to-have

- Screenshot of one thing you loved
- Screenshot of one thing that confused you
- Name 2–3 brands you’d want indexed for a follow-up session

---

## Demo limitations (by design)

- **Read-only** — no scans, no new workspaces, no integrations
- **Two advertisers only** — CommBank + Woolworths war rooms
- **Shared login** — don’t upload sensitive client data here
- Some features may be **behind active billing** in production; the demo bypasses paywall but keeps showcase scope

---

## After the beta

If you want a **private workspace** with your clients and competitors indexed:

- Email **hello@revenuad.com** with your agency name + 3–5 competitor domains
- We’ll set up a trial workspace (not the shared beta login)

---

## Technical issues

| Problem | Try |
|---------|-----|
| “Invalid login” | Copy password exactly: `RevenueAdBeta2026!` (case-sensitive) |
| Paywall screen | Sign out, sign in again with `beta@revenuad.com` |
| Empty war room | Refresh; demo uses live + cached data — occasional load delay |
| Page not found | Stay in sidebar links — demo blocks routes outside showcase |

---

*RevenuAD Signal · revenuad.com · Competitive ad intelligence for agencies*
