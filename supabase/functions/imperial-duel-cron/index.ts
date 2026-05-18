// IMPERIAL-SINGULARITY: Duel Cron tick with telemetry
// Sweeps rooms past their settle_at horizon. Each room is settled
// independently so partial failures do not block others.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { newTraceId, tlog, traceHeaders } from "../_shared/duel-telemetry.ts";

const FN = "imperial-duel-cron";

function json(status: number, body: unknown, trace_id: string) {
  return new Response(JSON.stringify({ ...((body as object) ?? {}), trace_id }), {
    status,
    headers: { ...corsHeaders, ...traceHeaders(trace_id), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const trace_id = newTraceId();
  const t0 = Date.now();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Kill-switch short circuit
  const { data: ks } = await supabase
    .from("platform_kill_switches")
    .select("enabled")
    .eq("key", "phon_betting_enabled")
    .maybeSingle();
  if (!ks?.enabled) {
    await tlog(trace_id, FN, "info", "skipped_kill_switch", {});
    return json(200, { ok: true, skipped: "kill_switch_off" }, trace_id);
  }

  const now = new Date().toISOString();

  const { data: rooms, error } = await supabase
    .from("imperial_duel_rooms")
    .select("id, server_seed_plaintext, status, settle_at")
    .in("status", ["open", "locked"])
    .lt("settle_at", now)
    .eq("emergency_freeze_flag", false)
    .limit(50);

  if (error) {
    await tlog(trace_id, FN, "error", "scan_failed", { raw: error.message });
    return json(500, { error: error.message }, trace_id);
  }
  if (!rooms?.length) return json(200, { ok: true, processed: 0 }, trace_id);

  let ok = 0;
  const failures: Array<{ id: string; reason: string }> = [];

  for (const room of rooms) {
    if (!room.server_seed_plaintext) {
      failures.push({ id: room.id, reason: "missing_seed_plaintext" });
      await tlog(trace_id, FN, "error", "missing_seed", { room_id: room.id });
      continue;
    }
    try {
      const { error: rpcErr } = await supabase.rpc("imperial_settle_duel", {
        p_room_id: room.id,
        p_server_seed: room.server_seed_plaintext,
      });
      if (rpcErr) {
        failures.push({ id: room.id, reason: rpcErr.message });
        await tlog(trace_id, FN, "error", "settle_partial_fail", { room_id: room.id, raw: rpcErr.message });
        await supabase.from("imperial_duel_audit").insert({
          room_id: room.id,
          event: "cron_partial_fail",
          meta: { reason: rpcErr.message, at: now, trace_id },
        });
      } else {
        ok += 1;
      }
    } catch (e) {
      failures.push({ id: room.id, reason: String(e) });
      await tlog(trace_id, FN, "error", "settle_exception", { room_id: room.id, raw: String(e) });
    }
  }

  const latency_ms = Date.now() - t0;
  await tlog(trace_id, FN, failures.length ? "warn" : "info", "tick_complete",
    { processed: rooms.length, settled: ok, failed: failures.length, latency_ms });

  return json(200, { ok: true, processed: rooms.length, settled: ok, failures }, trace_id);
});
