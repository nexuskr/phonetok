import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { setVisibleInterval } from "@/lib/util/visible-interval";

export interface HotSymbol {
  sym: string;
  open_positions: number;
  traders_24h: number;
  score: number;
}

const HOT_POLL_MS = 30_000;
let CACHE: { at: number; rows: HotSymbol[] } = { at: 0, rows: [] };
let INFLIGHT: Promise<HotSymbol[]> | null = null;

async function fetchHot(limit: number): Promise<HotSymbol[]> {
  if (Date.now() - CACHE.at < HOT_POLL_MS && CACHE.rows.length) return CACHE.rows;
  if (INFLIGHT) return INFLIGHT;
  INFLIGHT = (async () => {
    const { data, error } = await supabase.rpc("get_hot_symbols_24h" as never, { _limit: limit } as never);
    INFLIGHT = null;
    if (error) return CACHE.rows;
    const rows = (data as HotSymbol[] | null) ?? [];
    CACHE = { at: Date.now(), rows };
    return rows;
  })();
  return INFLIGHT;
}

export function useHotSymbols(limit = 5) {
  const [rows, setRows] = useState<HotSymbol[]>(CACHE.rows);

  useEffect(() => {
    let alive = true;
    const tick = () => { void fetchHot(limit).then((r) => { if (alive) setRows(r); }); };
    tick();
    const stop = setVisibleInterval(tick, HOT_POLL_MS, {
      meta: { owner: "useHotSymbols", category: "cosmetic" },
    });
    return () => { alive = false; stop(); };
  }, [limit]);

  return rows;
}

export function useSymbolSideCounts(symbol: string) {
  const [counts, setCounts] = useState<{ longs: number; shorts: number }>({ longs: 0, shorts: 0 });

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const { data, error } = await supabase.rpc("get_symbol_side_counts" as never, { _symbol: symbol } as never);
      if (!alive || error) return;
      const row = (data as Array<{ longs: number; shorts: number }> | null)?.[0];
      if (row) setCounts({ longs: row.longs ?? 0, shorts: row.shorts ?? 0 });
    };
    void tick();
    const stop = setVisibleInterval(() => { void tick(); }, 15_000, {
      meta: { owner: "useSymbolSideCounts", category: "cosmetic" },
    });
    return () => { alive = false; stop(); };
  }, [symbol]);

  return counts;
}
