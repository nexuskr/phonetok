// attribute-click — public attribution entry point.
// Resolves a referral code → inviter user → upserts a depth=1 chain row.
// Self-attribution and depth>1 are blocked at DB layer (guard_attribution_depth_one).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const ref_code = String(body?.ref_code ?? "").trim();
  const anon_id = String(body?.anon_id ?? "").trim();
  const platform = String(body?.platform ?? "web").trim().slice(0, 32);

  if (!ref_code || ref_code.length < 4 || ref_code.length > 32) {
    return json(400, { error: "invalid_ref_code" });
  }
  if (!anon_id || anon_id.length < 8 || anon_id.length > 64) {
    return json(400, { error: "invalid_anon_id" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Resolve inviter by referral_code
  const { data: inviter, error: invErr } = await sb
    .from("profiles")
    .select("id")
    .eq("referral_code", ref_code)
    .maybeSingle();
  if (invErr) { console.error("[attribute-click] lookup_failed", invErr); return json(500, { error: "internal_error" }); }
  if (!inviter) return json(404, { error: "ref_code_not_found" });

  // Optional: invitee_id if caller is signed in
  let invitee_id: string | null = null;
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const { data } = await sb.auth.getUser(token);
      invitee_id = data?.user?.id ?? null;
      if (invitee_id === inviter.id) {
        return json(400, { error: "self_attribution_blocked" });
      }
    }
  } catch (_) { /* ignore — anon click */ }

  // Upsert chain (one per inviter × invitee, or per anon_id if invitee unknown)
  let chainId: string | null = null;
  if (invitee_id) {
    const { data: existing } = await sb
      .from("viral_attribution_chain")
      .select("id, status")
      .eq("inviter_id", inviter.id)
      .eq("invitee_id", invitee_id)
      .maybeSingle();
    if (existing) {
      chainId = existing.id;
    } else {
      const { data: ins, error: insErr } = await sb
        .from("viral_attribution_chain")
        .insert({
          anon_id,
          inviter_id: inviter.id,
          invitee_id,
          depth: 1,
          status: "signed_up",
        })
        .select("id")
        .single();
      if (insErr) { console.error("[attribute-click] chain_insert_failed", insErr); return json(400, { error: "chain_insert_failed" }); }
      chainId = ins.id;
    }
  } else {
    // anon click — keep one row per (inviter, anon_id) day-bucket via existing index lookup
    const { data: existing } = await sb
      .from("viral_attribution_chain")
      .select("id")
      .eq("inviter_id", inviter.id)
      .eq("anon_id", anon_id)
      .is("invitee_id", null)
      .maybeSingle();
    if (existing) {
      chainId = existing.id;
    } else {
      const { data: ins, error: insErr } = await sb
        .from("viral_attribution_chain")
        .insert({
          anon_id,
          inviter_id: inviter.id,
          depth: 1,
          status: "clicked",
        })
        .select("id")
        .single();
      if (insErr) { console.error("[attribute-click] chain_insert_failed (anon)", insErr); return json(400, { error: "chain_insert_failed" }); }
      chainId = ins.id;
    }
  }

  // Log a conversion event (existing table; admin-only read RLS)
  await sb.from("conversion_events").insert({
    anon_id,
    user_id: invitee_id,
    event_type: "viral_click",
    surface: "attribute-click",
    variant: platform,
    meta: { ref_code, chain_id: chainId },
  });

  return json(200, { ok: true, chain_id: chainId, has_invitee: !!invitee_id });
});
