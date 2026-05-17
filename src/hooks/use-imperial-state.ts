import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNowTick } from "@/hooks/use-now-tick";
import { shouldTripCircuit, tripCircuit, isCircuitTripped } from "@/lib/rpc-circuit";
import { setVisibleInterval } from "@/lib/util/visible-interval";

export type ImperialState = {
  total_is: number;
  daily_is: number;
  weekly_is: number;
  season_is: number;
  booster_active: boolean;
  booster_expires_at: string | null;
  booster_hours_accumulated: number;
  today_deposit_krw: number;
  lifetime_deposit_krw: number;
  trading_position_cap_krw: number;
  next_milestone: null | {
    key: string;
    label: string;
    threshold_krw: number;
    threshold_window: "daily" | "lifetime";
    remaining_krw: number;
    reward_json: { perks?: string[] };
  };
  whale_rank_today: number | null;
};

const EMPTY: ImperialState = {
  total_is: 0,
  daily_is: 0,
  weekly_is: 0,
  season_is: 0,
  booster_active: false,
  booster_expires_at: null,
  booster_hours_accumulated: 0,
  today_deposit_krw: 0,
  lifetime_deposit_krw: 0,
  trading_position_cap_krw: 0,
  next_milestone: null,
  whale_rank_today: null,
};

const DASHBOARD_STATE_DISABLED_KEY = "phonara_disable_dashboard_state_rpc";

// Module-scope SWR cache to dedupe across multiple component mounts.
// Fresh window: within FRESH_MS no new RPC fires, cached state served instantly.
const FRESH_MS = 15_000;
let cachedState: ImperialState | null = null;
let lastFetchedAt = 0;
let inflight: Promise<ImperialState | null> | null = null;
const subscribers = new Set<(s: ImperialState) => void>();

function broadcast(next: ImperialState) {
  cachedState = next;
  for (const cb of subscribers) {
    try { cb(next); } catch { /* ignore */ }
  }
}

async function fetchDashboardState(force = false): Promise<ImperialState | null> {
  if (isCircuitTripped(DASHBOARD_STATE_DISABLED_KEY)) return cachedState;
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/guide")) return cachedState;

  const now = Date.now();
  if (!force && cachedState && now - lastFetchedAt < FRESH_MS) return cachedState;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session?.user) return cachedState;
      const { data, error } = await supabase.rpc("get_my_dashboard_state" as any);
      if (error) {
        if (shouldTripCircuit(error)) tripCircuit(DASHBOARD_STATE_DISABLED_KEY);
        return cachedState;
      }
      if (data && typeof data === "object") {
        const next = { ...EMPTY, ...(data as any) } as ImperialState;
        lastFetchedAt = Date.now();
        broadcast(next);
        return next;
      }
      return cachedState;
    } catch {
      return cachedState;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function useImperialState() {
  const [state, setState] = useState<ImperialState>(cachedState ?? EMPTY);
  const [loading, setLoading] = useState(cachedState === null);

  const refresh = useCallback(async () => {
    const next = await fetchDashboardState();
    if (next) setState(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    const cb = (s: ImperialState) => { if (alive) setState(s); };
    subscribers.add(cb);
    refresh();
    // Polling cadence relaxed 30s → 60s; dedupe guarantees ≤1 RPC per FRESH_MS window.
    const stop = setVisibleInterval(() => { if (alive) void fetchDashboardState(); }, 60_000);
    const onFocus = () => { void fetchDashboardState(); };
    const onWalletRefresh = () => { void fetchDashboardState(true); };
    window.addEventListener("focus", onFocus);
    window.addEventListener("wallet:refresh", onWalletRefresh);
    return () => {
      alive = false;
      subscribers.delete(cb);
      stop();
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("wallet:refresh", onWalletRefresh);
    };
  }, [refresh]);

  return { state, loading, refresh };
}

/** Returns "HH:MM:SS" remaining string, or null if expired/none. */
export function useBoosterCountdown(expiresAt: string | null) {
  const now = useNowTick(2000);
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
