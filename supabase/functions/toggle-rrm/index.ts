// toggle-rrm — admin-only wrapper around the toggle_rrm RPC.
// Validates JWT, calls RPC (which itself enforces admin + audit log).
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

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json(401, { error: "unauthenticated" });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const enabled = !!body?.enabled;
  const reason = String(body?.reason ?? "").slice(0, 500);

  if (!enabled && reason.trim().length < 8) {
    return json(400, { error: "reason_required_when_disabling" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await userClient.rpc("toggle_rrm", {
    _enabled: enabled,
    _reason: reason || null,
  });

  if (error) {
    return json(error.code === "42501" ? 403 : 400, {
      error: "rpc_failed",
      detail: error.message,
    });
  }
  return json(200, data);
});
