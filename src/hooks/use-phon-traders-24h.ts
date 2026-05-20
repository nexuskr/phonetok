/**
 * usePhonTraders24h — get_phon_traders_24h() 60초 폴링.
 * P0-1: setVisibleInterval — 백그라운드 탭에서는 호출 skip.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { setVisibleInterval } from "@/lib/util/visible-interval";

export function usePhonTraders24h() {
  const [count, setCount] = useState<number>(0);
  useEffect(() => {
    let alive = true;
    const fetchOnce = async () => {
      const { data } = await (supabase as any).rpc("get_phon_traders_24h");
      if (alive && typeof data === "number") setCount(data);
    };
    void fetchOnce();
    const stop = setVisibleInterval(() => { void fetchOnce(); }, 60_000, {
      meta: { owner: "usePhonTraders24h", category: "cosmetic" },
    });
    return () => { alive = false; stop(); };
  }, []);
  return count;
}
