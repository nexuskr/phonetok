import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { setVisibleInterval } from "@/lib/util/visible-interval";

export interface MissionRecoveryState {
  consecutiveFails: number;
  recoveryPct: number;
  easyMode: boolean;
  loading: boolean;
}

const POLL_MS = 5 * 60 * 1000;

/**
 * useMissionRecovery — 3일 연속 미션 실패 회복 상태 폴링.
 * 자동으로 record_mission_outcome 1회 호출하여 어제 실패 finalize.
 */
export function useMissionRecovery() {
  const [state, setState] = useState<MissionRecoveryState>({
    consecutiveFails: 0,
    recoveryPct: 0,
    easyMode: false,
    loading: true,
  });

  const refresh = useCallback(async () => {
    try {
      await supabase.rpc("record_mission_outcome" as any, { _completed_today: 0 } as any);
      const { data, error } = await supabase.rpc("get_mission_recovery_state" as any);
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      setState({
        consecutiveFails: Number((row as any)?.consecutive_fails ?? 0),
        recoveryPct: Number((row as any)?.recovery_pct ?? 0),
        easyMode: !!(row as any)?.easy_mode,
        loading: false,
      });
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const stop = setVisibleInterval(() => void refresh(), POLL_MS, {
      meta: { owner: "useMissionRecovery", category: "cosmetic" },
    });
    return () => stop();
  }, [refresh]);

  return { ...state, refresh };
}

/**
 * applyRecoveryBonus — 미션 보상 수령 후 호출. 30% 가산 PHON 입금 (일 1회).
 */
export async function applyRecoveryBonus(baseAmount: number, kind: string) {
  try {
    const { data } = await supabase.rpc("apply_recovery_bonus" as any, {
      _base_amount: baseAmount,
      _kind: kind,
    } as any);
    return data as { ok: boolean; bonus?: number; pct?: number; reason?: string };
  } catch {
    return { ok: false } as const;
  }
}
