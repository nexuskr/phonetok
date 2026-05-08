// Catalog cache client — fetches static catalog tables via the cached edge function.
// Uses sessionStorage + ETag so repeat visits in the same session are instant.

const PROJECT_ID = (import.meta as any).env?.VITE_SUPABASE_PROJECT_ID as string;
const ENDPOINT = `https://${PROJECT_ID}.supabase.co/functions/v1/catalog-cache`;
const STORAGE_KEY = "pm_catalog_cache_v1";
const ETAG_KEY = "pm_catalog_etag_v1";

export type Catalog = {
  achievements: any[];
  badges: any[];
  quests: any[];
  seasons: any[];
  tier_limits: any[];
  season_pass_rewards: any[];
  generated_at: string;
};

let inflight: Promise<Catalog> | null = null;

export async function fetchCatalog(force = false): Promise<Catalog> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const cached = !force && sessionStorage.getItem(STORAGE_KEY);
      const etag = !force && sessionStorage.getItem(ETAG_KEY);
      const headers: Record<string, string> = {};
      if (etag) headers["If-None-Match"] = etag;

      const res = await fetch(ENDPOINT + (force ? "?force=1" : ""), { headers });

      if (res.status === 304 && cached) {
        return JSON.parse(cached) as Catalog;
      }

      if (!res.ok) {
        if (cached) return JSON.parse(cached) as Catalog;
        throw new Error(`catalog-cache ${res.status}`);
      }

      const data = (await res.json()) as Catalog;
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        const newEtag = res.headers.get("etag");
        if (newEtag) sessionStorage.setItem(ETAG_KEY, newEtag);
      } catch {}
      return data;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

// Fire-and-forget warmup, safe to call on app boot.
export function prefetchCatalog() {
  if (typeof window === "undefined") return;
  if ("requestIdleCallback" in window) {
    (window as any).requestIdleCallback(() => { void fetchCatalog().catch(() => {}); });
  } else {
    setTimeout(() => { void fetchCatalog().catch(() => {}); }, 1500);
  }
}
