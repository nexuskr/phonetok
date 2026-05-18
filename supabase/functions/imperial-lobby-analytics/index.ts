// Sprint 4 — imperial-lobby-analytics (admin)
// Wraps admin_get_lobby_analytics with a small in-memory 5s cache.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;

const CACHE = new Map<number, { at: number; data: unknown }>();
const TTL_MS = 5_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sb = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });

    const url = new URL(req.url);
    const wh = Math.max(1, Math.min(168, Number(url.searchParams.get("window_hours") ?? 24)));

    const hit = CACHE.get(wh);
    if (hit && Date.now() - hit.at < TTL_MS) {
      return new Response(JSON.stringify({ ok: true, cached: true, ...hit.data as Record<string, unknown> }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // RPC will enforce admin role and 42501 if not admin
    const { data, error } = await sb.rpc("admin_get_lobby_analytics", { window_hours: wh });
    if (error) {
      const status = /forbidden|42501/i.test(error.message) ? 403 : 500;
      return new Response(JSON.stringify({ error: error.message }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    CACHE.set(wh, { at: Date.now(), data: data as Record<string, unknown> });
    if (CACHE.size > 16) CACHE.clear();

    return new Response(JSON.stringify({ ok: true, cached: false, ...(data as Record<string, unknown>) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: "internal", message: String((e as Error).message ?? e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
