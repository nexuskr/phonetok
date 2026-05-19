/**
 * useApexGame — single RPC entry for all ApexForge mini-games.
 * Wraps apex_play_mock_game (SECURITY DEFINER). Money-flow safe.
 */
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { notify, describeError } from "@/lib/notify";

export type ApexGameCode =
  | "dice" | "crash" | "plinko" | "mines" | "slots_lite" | "sportsbook";

export interface ApexPlayResult {
  ok: boolean;
  multiplier: number;
  payout_phon: number;
  payout_usdt: number;
  result: any;
  server_seed_hash: string;
  client_seed: string;
  nonce: number;
  roll_id: string;
  error?: string;
}

export function useApexGame() {
  const [loading, setLoading] = useState(false);
  const [last, setLast] = useState<ApexPlayResult | null>(null);

  const play = useCallback(
    async (
      game: ApexGameCode,
      bet: { phon?: number; usdt?: number },
      params: Record<string, unknown> = {},
    ): Promise<ApexPlayResult | null> => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc("apex_play_mock_game" as any, {
          _game_code: game,
          _bet_phon: bet.phon ?? 0,
          _bet_usdt: bet.usdt ?? 0,
          _params: params as any,
        });
        if (error) throw error;
        const res = data as unknown as ApexPlayResult;
        if (!res?.ok) {
          notify.warning(res?.error ?? "베팅 실패", {
            description: "잔액·일일 한도(50회)·정지 여부를 확인해 주세요.",
          });
          return null;
        }
        setLast(res);
        const stake = (bet.phon ?? 0) + (bet.usdt ?? 0) * 1300;
        const payout = Number(res.payout_phon) + Number(res.payout_usdt) * 1300;
        const net = payout - stake;
        if (res.multiplier >= 10) {
          notify.imperial(`MEGA WIN x${Number(res.multiplier).toFixed(2)}`, {
            description: `+${Math.floor(Math.abs(net)).toLocaleString("ko-KR")} ≈ PHON`,
            kind: "apex_win",
          });
        } else if (net > 0) {
          notify.passive(`WIN x${Number(res.multiplier).toFixed(2)}`, {
            description: `+${Math.floor(net).toLocaleString("ko-KR")} ≈ PHON`,
          });
        }
        return res;
      } catch (e) {
        notify.error("게임 오류", { description: describeError(e) });
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { play, loading, last };
}
