// apex-squad-mirror-tick — 1m cron janitor. 30m 동안 활동 없는 open squad를 done 으로 마감.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: closed } = await admin
      .from("apex_squad_rooms")
      .update({ status: "done", updated_at: new Date().toISOString() })
      .eq("status", "open")
      .lt("updated_at", new Date(Date.now() - 30 * 60_000).toISOString())
      .select("id");
    return new Response(JSON.stringify({ ok: true, closed: closed?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
