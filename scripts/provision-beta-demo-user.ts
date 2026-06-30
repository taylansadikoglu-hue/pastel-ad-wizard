#!/usr/bin/env npx tsx
/**
 * Create or update the shared media beta demo user (beta@revenuad.com).
 *
 * SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run beta:provision-demo
 */
import { createClient } from "@supabase/supabase-js";
import { BETA_DEMO_EMAIL, BETA_DEMO_PASSWORD, DEMO_ROLE } from "../src/lib/demo-account.ts";

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const metadata = { role: DEMO_ROLE, app_role: DEMO_ROLE, beta_media: true };

  const { data: listed, error: listErr } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (listErr) throw listErr;

  const existing = listed.users.find((u) => u.email?.toLowerCase() === BETA_DEMO_EMAIL);

  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password: BETA_DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { ...existing.user_metadata, ...metadata },
    });
    if (error) throw error;
    console.log(JSON.stringify({ action: "updated", userId: data.user.id, email: BETA_DEMO_EMAIL }, null, 2));
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: BETA_DEMO_EMAIL,
      password: BETA_DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: metadata,
    });
    if (error) throw error;
    console.log(JSON.stringify({ action: "created", userId: data.user.id, email: BETA_DEMO_EMAIL }, null, 2));
  }

  console.log("\nShare with media beta testers:");
  console.log(`  URL:      ${process.env.APP_URL ?? "https://revenuad.com"}/auth`);
  console.log(`  Email:    ${BETA_DEMO_EMAIL}`);
  console.log(`  Password: ${BETA_DEMO_PASSWORD}`);
  console.log("\nSee docs/beta-media-intro.md for the tester guide.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
