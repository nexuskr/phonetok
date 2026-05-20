/**
 * useRecentPhonWins — get_recent_phon_wins() 60초 폴링.
 * P0-1: setVisibleInterval — 백그라운드 탭에서는 호출 skip.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { setVisibleInterval } from "@/lib/util/visible-interval";

export interface PhonWin {
  masked_nick: string;
  pnl_phon: number;
  closed_at: string;
}

export function useRecentPhonWins(limit = 8) {
  const [rows, setRows] = useState<PhonWin[]>([]);
  useEffect(() => {
    let alive = true;
    const fetchOnce = async () => {
      const { data } = await (supabase as any).rpc("get_recent_phon_wins", { _limit: limit });
      if (alive && Array.isArray(data)) setRows(data as PhonWin[]);
    };
    void fetchOnce();
    const stop = setVisibleInterval(() => { void fetchOnce(); }, 60_000, {
      meta: { owner: "useRecentPhonWins", category: "cosmetic" },
    });
    return () => { alive = false; stop(); };
  }, [limit]);
  return rows;
}
