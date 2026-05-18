// Sprint 4 — imperial-metrics-batch
// Batch-ingest client UX telemetry (web-vitals, FPS, haptic/swipe success).
// Insert path: service_role only → DB RLS blocks anon/auth direct writes.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;

const ALLOWED_METRICS = new Set([
  "inp","lcp","cls","fps_sample","haptic_ok","haptic_fail","swipe_ok","swipe_fail",
]);
const ALLOWED_ROUTES = /^\/[a-z0-9/_\-]{0,80}$/i;

// In-memory rate limit + dedup (per warm instance — best-effort, not strict)
const RATE_BUCKET = new Map<string, number>();   // key → last ts
const DEDUP_SET   = new Map<string, number>();   // key → ts
const RATE_WINDOW_MS  = 8_000;
const DEDUP_WINDOW_MS = 5 * 60_000;

function gcMaps() {
  const now = Date.now();
  for (const [k, t] of RATE_BUCKET) if (now - t > RATE_WINDOW_MS * 4) RATE_BUCKET.delete(k);
  for (const [k, t] of DEDUP_SET)   if (now - t > DEDUP_WINDOW_MS)    DEDUP_SET.delete(k);
}

function bucket(value: number, metric: string): number {
  // crude quantisation for dedup
  if (metric === "cls") return Math.round(value * 100);
  if (metric === "fps_sample") return Math.round(value);
  return Math.floor(value / 50); // ms-scale
}

function safeMeta(m: unknown): Record<string, unknown> {
  if (!m || typeof m !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(m as Record<string, unknown>)) {
    if (k.length > 32) continue;
    if (typeof v === "string" && v.length > 64) continue;
    if (["string","number","boolean"].includes(typeof v)) out[k] = v;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "method_not_allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Identify caller (optional — anonymous allowed for top-of-funnel measurement)
    let userId: string | null = null;
    const auth = req.headers.get("Authorization");
    if (auth?.startsWith("Bearer ")) {
      const sb = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: auth } },
      });
      const token = auth.replace("Bearer ", "");
      const { data } = await sb.auth.getClaims(token);
      if (data?.claims?.sub) userId = data.claims.sub as string;
    }

    // Rate limit (1 call / 8s per user-or-IP)
    const rateKey = userId
      ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? "anon";
    const now = Date.now();
    const last = RATE_BUCKET.get(rateKey) ?? 0;
    if (now - last < RATE_WINDOW_MS) {
      return new Response(JSON.stringify({ error: "rate_limited" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "8" } });
    }
    RATE_BUCKET.set(rateKey, now);
    if (RATE_BUCKET.size > 5000) gcMaps();

    // Parse + validate
    let body: unknown;
    try { body = await req.json(); } catch {
      return new Response(JSON.stringify({ error: "invalid_json" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const events = (body as { events?: unknown })?.events;
    if (!Array.isArray(events) || events.length === 0 || events.length > 50) {
      return new Response(JSON.stringify({ error: "invalid_events" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ua = req.headers.get("user-agent") ?? "";
    const ua_class = /Mobi|Android|iPhone/i.test(ua) ? "mobile" : "desktop";
    const minuteBucket = Math.floor(now / 60_000);

    const rows: Array<{ user_id: string | null; route: string; metric: string; value: number; meta: Record<string, unknown> }> = [];
    for (const raw of events as Array<Record<string, unknown>>) {
      const route = String(raw?.route ?? "");
      const metric = String(raw?.metric ?? "");
      const value = Number(raw?.value);
      if (!ALLOWED_METRICS.has(metric)) continue;
      if (!ALLOWED_ROUTES.test(route))  continue;
      if (!Number.isFinite(value))      continue;

      const dKey = `${rateKey}:${route}:${metric}:${bucket(value, metric)}:${minuteBucket}`;
      if (DEDUP_SET.has(dKey)) continue;
      DEDUP_SET.set(dKey, now);

      rows.push({
        user_id: userId,
        route,
        metric,
        value,
        meta: { ...safeMeta(raw.meta), ua_class },
      });
    }

    if (rows.length === 0) {
      return new Response(JSON.stringify({ ok: true, inserted: 0, skipped: events.length }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { error } = await admin.from("client_metrics").insert(rows);
    if (error) {
      await admin.from("client_metrics_error_log").insert({
        payload: { rateKey, count: rows.length, sample: rows[0] },
        error: error.message,
      });
      return new Response(JSON.stringify({ error: "insert_failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, inserted: rows.length, skipped: events.length - rows.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: "internal", message: String((e as Error).message ?? e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
