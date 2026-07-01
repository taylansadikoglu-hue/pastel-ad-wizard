#!/usr/bin/env npx tsx
/**
 * Exchange META_ACCESS_TOKEN for a new long-lived token (60 days).
 * Requires META_APP_ID, META_APP_SECRET, and a still-valid META_ACCESS_TOKEN.
 *
 * If token is already expired (Session has expired on …), generate a new
 * system user token in Meta Business Manager — this script cannot recover.
 *
 * npm run meta:refresh-token
 * npm run meta:refresh-token -- --write-env   # updates .env in cwd (server only)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { argBool, parseArgs } from "./lib/parseArgs.ts";

const GRAPH_VERSION = process.env.META_GRAPH_VERSION ?? "v21.0";

async function main() {
  const args = parseArgs(process.argv);
  const writeEnv = argBool(args, "writeEnv");
  const envPath = resolve(process.cwd(), ".env");

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const token = process.env.META_ACCESS_TOKEN;

  if (!appId || !appSecret || !token) {
    console.error("Required env vars: META_APP_ID, META_APP_SECRET, META_ACCESS_TOKEN");
    console.error("Run on the server: cd /opt/revenuad && source .env && npm run meta:refresh-token");
    process.exit(1);
  }

  const verifyUrl = `https://graph.facebook.com/${GRAPH_VERSION}/me?access_token=${encodeURIComponent(token)}`;
  const verifyRes = await fetch(verifyUrl);
  const verifyBody = (await verifyRes.json()) as { error?: { message: string; code: number }; id?: string };

  if (verifyBody.error) {
    console.error("Current token is invalid or expired:");
    console.error(`  ${verifyBody.error.message}`);
    console.error("\nGenerate a new System User token in Meta Business Manager.");
    console.error("See docs/meta-access-token.md");
    process.exit(1);
  }

  console.log(`Current token valid for app user id: ${verifyBody.id}`);

  const exchangeUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
  exchangeUrl.searchParams.set("grant_type", "fb_exchange_token");
  exchangeUrl.searchParams.set("client_id", appId);
  exchangeUrl.searchParams.set("client_secret", appSecret);
  exchangeUrl.searchParams.set("fb_exchange_token", token);

  const exchangeRes = await fetch(exchangeUrl);
  const exchangeBody = (await exchangeRes.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: { message: string };
  };

  if (exchangeBody.error || !exchangeBody.access_token) {
    console.error("Token exchange failed:", exchangeBody.error?.message ?? exchangeRes.statusText);
    process.exit(1);
  }

  const expiresIn = exchangeBody.expires_in ?? 0;
  const expiresDays = Math.round(expiresIn / 86_400);
  console.log(`New token received (expires in ~${expiresDays} days)`);
  console.log(`META_ACCESS_TOKEN=${exchangeBody.access_token}`);

  if (writeEnv) {
    if (!existsSync(envPath)) {
      console.error(`.env not found at ${envPath}`);
      process.exit(1);
    }
    let content = readFileSync(envPath, "utf8");
    if (/^META_ACCESS_TOKEN=/m.test(content)) {
      content = content.replace(/^META_ACCESS_TOKEN=.*$/m, `META_ACCESS_TOKEN=${exchangeBody.access_token}`);
    } else {
      content += `\nMETA_ACCESS_TOKEN=${exchangeBody.access_token}\n`;
    }
    writeFileSync(envPath, content);
    console.log(`Updated ${envPath}`);
    console.log("Run: pm2 restart revenuad-meta-source");
  } else {
    console.log("\nTo write to .env on server: npm run meta:refresh-token -- --write-env");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
