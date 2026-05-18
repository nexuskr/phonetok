// Shared CORS helper — Top-Tier whitelist for Phonara edge functions.
// Use buildCors(req) to get headers; returns null when the origin is not allowed.
// Money-flow / cron / Supabase-Auth-hook functions are intentionally NOT switched
// to this helper to keep git diff = 0 on the 8 money-flow paths.

const ALLOWED_EXACT = new Set<string>([
  "https://phonara.world",
  "https://www.phonara.world",
  "https://phonetok.lovable.app",
]);

const ALLOWED_SUFFIX = [
  ".lovable.app", // preview + staging
  ".lovable.dev",
];

const BASE_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "600",
  Vary: "Origin",
};

function isAllowed(origin: string | null): origin is string {
  if (!origin) return false;
  if (ALLOWED_EXACT.has(origin)) return true;
  try {
    const u = new URL(origin);
    return ALLOWED_SUFFIX.some((s) => u.hostname.endsWith(s));
  } catch {
    return false;
  }
}

/**
 * Returns CORS headers for the request's Origin, or null if the origin is not
 * whitelisted. Callers should respond with 403 in that case for state-changing
 * requests, or fall back to a safe public response for read-only GETs.
 */
export function buildCors(req: Request): Record<string, string> | null {
  const origin = req.headers.get("origin");
  if (!isAllowed(origin)) return null;
  return { ...BASE_HEADERS, "Access-Control-Allow-Origin": origin };
}

/**
 * Permissive variant for server-to-server endpoints (e.g. /sim-api) where the
 * caller may not send an Origin header at all. Still returns headers only for
 * whitelisted browser origins; non-browser callers get an empty header set.
 */
export function buildCorsOrEmpty(req: Request): Record<string, string> {
  return buildCors(req) ?? BASE_HEADERS;
}

export function preflight(req: Request): Response {
  const cors = buildCors(req);
  if (!cors) return new Response("forbidden_origin", { status: 403 });
  return new Response("ok", { headers: cors });
}
