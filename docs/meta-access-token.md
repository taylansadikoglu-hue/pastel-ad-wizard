# Meta access token refresh (`META_ACCESS_TOKEN`)

Used by **brand ingest** (`/api/ingest` Meta source) and `revenuad-meta-source` PM2 process.

**Not** used by AdLibrary batch ingest — that uses `ADLIBRARY_API_KEY` (your 21,461 ads refresh already succeeded via that path).

## Quick fix (production server)

```bash
ssh your-server
cd /opt/revenuad

# 1. Generate new token (see below), then:
nano .env   # or vim — update META_ACCESS_TOKEN=...

# 2. Restart Meta source only
pm2 restart revenuad-meta-source

# 3. Verify
curl -s "https://graph.facebook.com/v21.0/me?access_token=$META_ACCESS_TOKEN" | jq .
# Should return id/name, not "Session has expired"
```

## Generate a new token (recommended: System User)

1. Open [developers.facebook.com](https://developers.facebook.com) → your app
2. **Business Settings** → **Users** → **System users** → select or create a system user
3. **Generate token** → select your app
4. Scopes required for Ad Library reads:
   - `ads_read`
   - `pages_read_engagement` (if reading page-linked ads)
   - For Graph `ads_archive` endpoint: Ad Library API access must be approved on the app
5. Copy token → paste into `/opt/revenuad/.env` as `META_ACCESS_TOKEN`
6. Optionally set `META_APP_ID` and `META_APP_SECRET` for automated refresh (see script below)

### Token types

| Type | Lifetime | Use |
|------|----------|-----|
| Short-lived user token | ~1 hour | Dev only |
| Long-lived user token | 60 days | Expired 23-Jun-26 in your case |
| System user token | 60 days (or non-expiring if configured) | **Production** |

## Refresh without re-login (if token not yet expired)

If you still have a valid token within 60 days:

```bash
cd /opt/revenuad
npm run meta:refresh-token
```

Or manually:

```bash
curl -G "https://graph.facebook.com/v21.0/oauth/access_token" \
  -d "grant_type=fb_exchange_token" \
  -d "client_id=$META_APP_ID" \
  -d "client_secret=$META_APP_SECRET" \
  -d "fb_exchange_token=$META_ACCESS_TOKEN"
```

Response includes `access_token` and `expires_in`. Update `.env` and restart PM2.

## After token expired (your situation)

You **cannot** exchange an expired token. You must:

1. Log into Meta Business Manager as an admin
2. Generate a **new** system user token (steps above)
3. Replace `META_ACCESS_TOKEN` in `.env`
4. `pm2 restart revenuad-meta-source`

## Dedup note

With canonical placement dedup (PR #41), **AdLibrary is the primary Meta source**. If AdLibrary ingest already ran for an advertiser, the Apify/Meta brand-queue path is redundant for those brands. Consider:

```bash
pm2 stop revenuad-meta-source   # until token fixed, or permanently if AdLibrary covers Meta
```

AdLibrary already indexed Meta ads for 100 brands (ANZ, Westpac, NAB, etc.).

## Verify Ad Library API access

```bash
curl -G "https://graph.facebook.com/v21.0/ads_archive" \
  --data-urlencode "access_token=$META_ACCESS_TOKEN" \
  --data-urlencode 'ad_reached_countries=["AU"]' \
  --data-urlencode "search_terms=commbank" \
  --data-urlencode "ad_active_status=ACTIVE" \
  --data-urlencode "limit=1"
```

Success: JSON with `data` array. Failure: `OAuthException` / `Session has expired`.

## Prevent recurrence

Add to cron on server (refresh every 30 days):

```cron
0 9 1 * * cd /opt/revenuad && npm run meta:refresh-token && pm2 restart revenuad-meta-source
```

Store `META_APP_ID`, `META_APP_SECRET`, and alert if refresh fails.
