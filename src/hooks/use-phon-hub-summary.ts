/**
 * use-phon-hub-summary — PhonHub v3 aggregate hook.
 * Single RPC `phon_hub_summary` (read-only) + 12s polling + realtime invalidate
 * on wallet partition (phon_balances / phon_stakes / phon_stake_yields).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWalletChannel, type ChannelBinding } from "@pkg/realtime";
import { setVisibleInterval } from "@/lib/util/visible-interval";

const POLL_MS = 12_000;

export type PhonHubSummary = {
  phon_balance: number;
  active_stake_total: number;
  today_yield: number;
  lifetime_yield: number;
  next_yield_at: string | null;
  leverage_max: number;
  boost_pct: number;
  swap_used_today: number;
  swap_daily_cap: number;
  lifetime_burn: number;
  phon_level_label: string;
  phon_level_progress_pct: number;
  server_now: string | null;
};

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalize(raw: any): PhonHubSummary | null {
  if (!raw || typeof raw !== "object") return null;
  return {
    phon_balance: toNum(raw.phon_balance),
    active_stake_total: toNum(raw.active_stake_total),
    today_yield: toNum(raw.today_yield),
    lifetime_yield: toNum(raw.lifetime_yield),
    next_yield_at: raw.next_yield_at ?? null,
    leverage_max: toNum(raw.leverage_max) || 10,
    boost_pct: toNum(raw.boost_pct),
    swap_used_today: toNum(raw.swap_used_today),
    swap_daily_cap: toNum(raw.swap_daily_cap) || 5_000_000,
    lifetime_burn: toNum(raw.lifetime_burn),
    phon_level_label: String(raw.phon_level_label ?? "Lv 1"),
    phon_level_progress_pct: Math.max(0, Math.min(100, toNum(raw.phon_level_progress_pct))),
    server_now: raw.server_now ?? null,
  };
}

export function usePhonHubSummary() {
  const [data, setData] = useState<PhonHubSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const aliveRef = useRef(true);

  const fetchOnce = useCallback(async () => {
    try {
      const { data: raw, error } = await supabase.rpc("phon_hub_summary" as any);
      if (!aliveRef.current) return;
      if (error) { setError(error.message); return; }
      const n = normalize(raw);
      if (n) { setData(n); setError(null); }
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    void fetchOnce();
    const stop = setVisibleInterval(() => { void fetchOnce(); }, POLL_MS, {
      meta: { owner: "usePhonHubSummary", category: "wallet" },
    });
    return () => { aliveRef.current = false; stop(); };
  }, [fetchOnce]);

  // Realtime: any change to my wallet/stake state → refresh quickly.
  const bindings: ChannelBinding[] = [
    { event: "*", table: "phon_balances" },
    { event: "*", table: "phon_stakes" },
    { event: "INSERT", table: "phon_stake_yields" },
  ];
  useWalletChannel({
    key: "phonhub:summary",
    bindings,
    onEvent: () => { void fetchOnce(); },
  });

  return { data, loading, error, refresh: fetchOnce };
}
