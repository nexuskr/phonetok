// Prefetch Trust page data and cache briefly so navigation feels instant.
// Cache is keyed by (days, auth user id) and invalidated on auth state changes.
import { supabase } from "@/integrations/supabase/client";

type Cache = {
  ts: number;
  days: 7 | 30;
  authKey: string;
  metrics: any;
  uptime: any;
  heatmap: any;
  chaos: any;
  history: any[];
};

let CACHE: Cache | null = null;
let INFLIGHT: Promise<Cache | null> | null = null;
const TTL = 30_000;
let CURRENT_AUTH_KEY: string = "anon";
let AUTH_LISTENER_INSTALLED = false;

function installAuthListener() {
  if (AUTH_LISTENER_INSTALLED) return;
  AUTH_LISTENER_INSTALLED = true;
  supabase.auth.getUser().then(({ data }) => {
    CURRENT_AUTH_KEY = data.user?.id ?? "anon";
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    const next = session?.user?.id ?? "anon";
    if (next !== CURRENT_AUTH_KEY) {
      CURRENT_AUTH_KEY = next;
      CACHE = null;
      INFLIGHT = null;
    }
  });
}
installAuthListener();

export function getTrustCache(days: 7 | 30): Cache | null {
  if (!CACHE) return null;
  if (CACHE.days !== days) return null;
  if (CACHE.authKey !== CURRENT_AUTH_KEY) return null;
  if (Date.now() - CACHE.ts > TTL) return null;
  return CACHE;
}

export function prefetchTrust(days: 7 | 30 = 30, force = false): Promise<Cache | null> {
  if (force) { CACHE = null; INFLIGHT = null; }
  const fresh = getTrustCache(days);
  if (fresh) return Promise.resolve(fresh);
  if (INFLIGHT) return INFLIGHT;
  const sb: any = supabase;
  const authKeyAtStart = CURRENT_AUTH_KEY;
  const daysAtStart = days;
  INFLIGHT = (async () => {
    try {
      const [md, ud] = await Promise.all([
        sb.rpc("public_trust_metrics"),
        sb.rpc("public_uptime_summary"),
      ]);
      const [hd, cd, histD] = await Promise.all([
        sb.rpc("public_uptime_heatmap_90d"),
        sb.rpc("latest_chaos_run"),
        sb.rpc("public_trust_history", { _days: daysAtStart }),
      ]);
      if (authKeyAtStart !== CURRENT_AUTH_KEY) return null;
      CACHE = {
        ts: Date.now(),
        days: daysAtStart,
        authKey: authKeyAtStart,
        metrics: md.data ?? null,
        uptime: ud.data ?? null,
        heatmap: ((hd.data as any)?.days ?? []),
        chaos: cd.data ?? null,
        history: (histD.data as any[]) ?? [],
      };
      return CACHE;
    } catch {
      return null;
    } finally {
      INFLIGHT = null;
    }
  })();
  return INFLIGHT;
}

export function invalidateTrustCache() { CACHE = null; INFLIGHT = null; }
