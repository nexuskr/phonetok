/**
 * useImperialDuelRoom — subscribes to a duel room's state via postgres_changes
 * on `imperial_duel_bets` (PR-J game partition) + periodic refresh.
 * MONEY_FLOW_NEW_PATH: phon_betting (Mode B).
 */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGameChannel } from "@pkg/realtime";

export type DuelState = {
  room_id: string;
  status: "open" | "locked" | "settled" | "cancelled";
  left_pot: number;
  right_pot: number;
  total_pot: number;
  settle_at: string | null;
  winner_side: "left" | "right" | null;
  /** IMPERIAL-SINGULARITY: admin-controlled emergency freeze */
  emergency_freeze_flag?: boolean;
  room?: { emergency_freeze_flag?: boolean; status?: string } & Record<string, unknown>;
  signals?: {
    near_miss_intensity?: number;
    cinematic_level?: number;
    perceived_win_rate?: number;
  };
};

export function isDuelFrozen(state: DuelState | null): boolean {
  if (!state) return false;
  return !!(state.emergency_freeze_flag ?? state.room?.emergency_freeze_flag);
}

export function useImperialDuelRoom(roomId: string | null) {
  const [state, setState] = useState<DuelState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc("imperial_get_duel_state", {
        p_room_id: roomId,
      });
      if (rpcErr) throw rpcErr;
      setState(data as unknown as DuelState);
    } catch (e: any) {
      setError(e?.message ?? "duel_state_failed");
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => { void refresh(); }, [refresh]);

  useGameChannel({
    key: roomId ? `imperial_duel:${roomId}` : "",
    bindings: roomId
      ? [
          { event: "*", table: "imperial_duel_bets", filter: `room_id=eq.${roomId}` },
          { event: "UPDATE", table: "imperial_duel_rooms", filter: `id=eq.${roomId}` },
        ]
      : [],
    onEvent: () => { void refresh(); },
    enabled: !!roomId,
    pollMs: 8000,
    onPoll: () => { void refresh(); },
  });

  return { state, loading, error, refresh };
}
