import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getIntegrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("integrations")
      .select("apify_token, dataforseo_login, dataforseo_password, resend_api_key")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? { apify_token: null, dataforseo_login: null, dataforseo_password: null, resend_api_key: null };
  });

const SaveSchema = z.object({
  apify_token: z.string().max(500).optional().nullable(),
  dataforseo_login: z.string().max(255).optional().nullable(),
  dataforseo_password: z.string().max(500).optional().nullable(),
  resend_api_key: z.string().max(500).optional().nullable(),
});

export const saveIntegrations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: Record<string, string | null> = {};
    for (const k of Object.keys(data) as (keyof typeof data)[]) {
      const v = data[k];
      if (v !== undefined && v !== "") patch[k] = v;
    }
    const { error } = await supabase
      .from("integrations")
      .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ProfileSchema = z.object({
  agency_name: z.string().min(1).max(255),
  agency_domain: z.string().max(255).optional().nullable(),
});

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProfileSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: userId, ...data }, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("agency_name, agency_domain")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });
