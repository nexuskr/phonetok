// IMPERIAL-SINGULARITY: shared telemetry helper for PHON Duel edge functions
// Emits structured console JSON + best-effort DB log via log_duel_telemetry RPC.
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

export type Severity = "info" | "warn" | "error";

export function newTraceId(): string {
  return crypto.randomUUID();
}

export function structLog(
  trace_id: string,
  fn: string,
  sev: Severity,
  event: string,
  extra: Record<string, unknown> = {},
) {
  const line = JSON.stringify({ trace_id, fn, sev, event, ts: new Date().toISOString(), ...extra });
  if (sev === "error") console.error(line);
  else if (sev === "warn") console.warn(line);
  else console.log(line);
}

let _svc: SupabaseClient | null = null;
function svc(): SupabaseClient {
  if (_svc) return _svc;
  _svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  return _svc;
}

export async function tlog(
  trace_id: string,
  fn: string,
  sev: Severity,
  event: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  structLog(trace_id, fn, sev, event, payload);
  try {
    await svc().rpc("log_duel_telemetry", {
      _trace: trace_id,
      _fn: fn,
      _sev: sev,
      _evt: event,
      _payload: payload,
    });
  } catch (_e) { /* never block business logic on telemetry */ }
}

export function traceHeaders(trace_id: string): Record<string, string> {
  return { "x-trace-id": trace_id };
}
