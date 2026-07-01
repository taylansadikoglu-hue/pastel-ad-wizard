#!/usr/bin/env npx tsx
/**
 * AM-friendly Meta token health check: identity, scopes, expiry, Ad Library ToS.
 *
 * META_ACCESS_TOKEN=... npm run meta:verify-token
 */
const GRAPH_VERSION = process.env.META_GRAPH_VERSION ?? "v25.0";
const token = process.env.META_ACCESS_TOKEN;

if (!token) {
  console.error("Set META_ACCESS_TOKEN");
  process.exit(1);
}

type GraphError = {
  message?: string;
  code?: number;
  error_subcode?: number;
  error_user_msg?: string;
};

function pad(label: string, width = 20): string {
  return label.padEnd(width);
}

function formatExpiry(epochSec: number | undefined): string {
  if (!epochSec || epochSec <= 0) return "non-expiring or unknown";
  const d = new Date(epochSec * 1000);
  const utc = d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const hoursLeft = (d.getTime() - Date.now()) / 3_600_000;
  if (hoursLeft < 0) return `${utc} (expired)`;
  if (hoursLeft < 48) return `${utc} (~${Math.round(hoursLeft)}hr)`;
  const daysLeft = Math.round(hoursLeft / 24);
  return `${utc} (~${daysLeft}d)`;
}

async function timedFetch(url: string): Promise<{ ms: number; body: unknown }> {
  const t0 = performance.now();
  const res = await fetch(url);
  const body = (await res.json()) as unknown;
  return { ms: Math.round(performance.now() - t0), body };
}

async function main() {
  const meUrl = `https://graph.facebook.com/${GRAPH_VERSION}/me?fields=id,name&access_token=${encodeURIComponent(token)}`;
  const { ms: meMs, body: meBody } = await timedFetch(meUrl);
  const me = meBody as { id?: string; name?: string; error?: GraphError };

  const debugUrl = `https://graph.facebook.com/${GRAPH_VERSION}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`;
  const { body: debugBody } = await timedFetch(debugUrl);
  const debug = debugBody as {
    data?: {
      is_valid?: boolean;
      scopes?: string[];
      expires_at?: number;
      data_access_expires_at?: number;
      app_id?: string;
      application?: string;
    };
    error?: GraphError;
  };

  const adsUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/ads_archive`);
  adsUrl.searchParams.set("access_token", token);
  adsUrl.searchParams.set("ad_reached_countries", '["AU"]');
  adsUrl.searchParams.set("search_terms", "commbank");
  adsUrl.searchParams.set("ad_active_status", "ACTIVE");
  adsUrl.searchParams.set("limit", "1");
  const { ms: adsMs, body: adsBody } = await timedFetch(adsUrl.toString());
  const ads = adsBody as { data?: unknown[]; error?: GraphError };

  const valid = debug.data?.is_valid === true && !me.error;
  const scopes = debug.data?.scopes?.join(", ") ?? "—";
  const expires = formatExpiry(debug.data?.expires_at);
  const adsOk = Array.isArray(ads.data);
  const tosBlocked = ads.error?.error_subcode === 2332002;

  console.log(`\nMeta token check (${GRAPH_VERSION}) — /me in ${meMs}ms\n`);
  console.log("┌─────────────────────┬─────────────────────────────────────────┐");
  console.log("│        Check        │                 Result                  │");
  console.log("├─────────────────────┼─────────────────────────────────────────┤");
  console.log(`│ ${pad("Token valid")} │ ${valid ? "✅ is_valid: true" : "❌ invalid"}`.padEnd(63) + "│");
  console.log(
    `│ ${pad("Identity")} │ ${me.name ? `✅ ${me.name}` : me.error?.message ?? "—"}`.slice(0, 61).padEnd(61) + " │",
  );
  console.log(`│ ${pad("Scopes")} │ ${scopes ? `✅ ${scopes}` : "—"}`.slice(0, 61).padEnd(61) + " │");
  console.log(`│ ${pad("Expires")} │ ${expires.startsWith("2026") || expires.includes("UTC") ? "⚠️ " : ""}${expires}`.slice(0, 61).padEnd(61) + " │");
  console.log(
    `│ ${pad("Ad Library API")} │ ${
      adsOk
        ? `✅ OK (${adsMs}ms, ${ads.data?.length ?? 0} row)`
        : tosBlocked
          ? "❌ ToS wall — error_subcode 2332002"
          : `❌ ${ads.error?.message ?? "failed"}`
    }`.slice(0, 61).padEnd(61) + " │",
  );
  console.log("└─────────────────────┴─────────────────────────────────────────┘\n");

  if (debug.data?.app_id) {
    console.log(`App: ${debug.data.application ?? "—"} (${debug.data.app_id})`);
    console.log(`Data access until: ${formatExpiry(debug.data.data_access_expires_at)}\n`);
  }

  if (tosBlocked) {
    console.log("Next: accept Ad Library ToS once at https://www.facebook.com/ads/library/api → Get Started");
    console.log("Then re-run: npm run meta:verify-token\n");
  } else if (valid && debug.data?.expires_at && debug.data.expires_at * 1000 - Date.now() < 7 * 86_400_000) {
    console.log("Token is short-lived. Exchange with META_APP_ID + META_APP_SECRET:");
    console.log("  npm run meta:refresh-token -- --write-env\n");
  }

  if (adsOk && valid) {
    console.log("Deploy to server:");
    console.log("  META_ACCESS_TOKEN='…' REVENUAD_SSH_USER=seedd npm run meta:deploy-token\n");
  }

  process.exit(valid && adsOk ? 0 : valid ? 2 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
