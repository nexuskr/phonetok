// apex-chat-stamp — Drand round + signature 자동 첨부 (fire-and-forget)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userData } = await supa.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) {
      return new Response(JSON.stringify({ error: "unauth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const body = await req.json().catch(() => ({}));
    const messageId = String(body?.message_id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(messageId)) {
      return new Response(JSON.stringify({ error: "bad_message_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    let round = 0;
    let sig = "";
    try {
      const r = await fetch(
        "https://api.drand.sh/52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971/public/latest",
        { signal: AbortSignal.timeout(2500) },
      );
      if (r.ok) {
        const j = await r.json();
        round = Number(j?.round ?? 0);
        sig = String(j?.signature ?? "").slice(0, 256);
      }
    } catch { /* drand unavailable — skip */ }
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    await admin.from("apex_chat_messages")
      .update({ drand_round: round || null, drand_signature: sig || null })
      .eq("id", messageId)
      .eq("user_id", uid);
    return new Response(JSON.stringify({ ok: true, round, sig }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
