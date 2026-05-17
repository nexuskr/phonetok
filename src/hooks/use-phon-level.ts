/**
 * usePhonLevel — current user's PHON level (1~100) + XP progress.
 * Uses wallet realtime partition (phon_levels reads).
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWalletChannel } from "@pkg/realtime";
import { xpToNext, PHON_MAX_LEVEL } from "@/lib/gamification";

export type PhonLevelState = {
  level: number;
  xp: number;
  xpToNext: number;
  totalXp: number;
  progressPct: number;
};

const DEFAULT: PhonLevelState = { level: 1, xp: 0, xpToNext: 100, totalXp: 0, progressPct: 0 };

export function usePhonLevel() {
  const [state, setState] = useState<PhonLevelState>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUid(user?.id ?? null);
      if (!user) { setState(DEFAULT); return; }
      const { data, error } = await (supabase.rpc as any)("get_my_phon_level");
      if (error || !Array.isArray(data) || data.length === 0) { setState(DEFAULT); return; }
      const row = data[0] as { level: number; xp: number | string; xp_to_next: number | string; total_xp: number | string };
      const level = Number(row.level ?? 1);
      const xp = Number(row.xp ?? 0);
      const next = Number(row.xp_to_next ?? xpToNext(level));
      const totalXp = Number(row.total_xp ?? 0);
      const pct = next > 0 ? Math.min(100, Math.round((xp / next) * 100)) : 100;
      setState({ level, xp, xpToNext: next, totalXp, progressPct: pct });
    } catch {
      setState(DEFAULT);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useWalletChannel({
    key: uid ? `phon-level:${uid}` : "",
    bindings: uid
      ? [{ event: "*", table: "phon_levels", filter: `user_id=eq.${uid}` }]
      : [],
    onEvent: () => void load(),
    enabled: !!uid,
  });

  return { ...state, loading, isMax: state.level >= PHON_MAX_LEVEL, reload: load };
}

/** Convenience alias matching naming spec. */
export const useLevel = usePhonLevel;
