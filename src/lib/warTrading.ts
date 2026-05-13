/**
 * War Trading client — 5분 슬롯 e-sports 시뮬 트레이딩.
 * - 모든 PnL/잔고는 SIM. 실제 자금 0 영향.
 * - Realtime: war_entries 채널 구독 → 리더보드 라이브 갱신.
 */
import { supabase } from "@/integrations/supabase/client";

export interface WarSession {
  id: string;
  slot_starts_at: string;
  slot_ends_at: string;
  status: "open" | "settling" | "closed";
  participants: number;
  winner_user_id: string | null;
  winner_pnl_pct: number | null;
  prize_phon: number;
  is_simulated: boolean;
}

export interface WarLeaderRow {
  rank: number;
  display_name: string;
  sim_pnl_pct: number;
  combo_max: number;
  is_self: boolean;
}

export async function warGetCurrentSession(): Promise<WarSession | null> {
  const { data, error } = await supabase.rpc("war_get_current_session");
  if (error) { console.warn("[war] session", error.message); return null; }
  return data as unknown as WarSession;
}

export async function warJoin(): Promise<boolean> {
  const { error } = await supabase.rpc("war_join_session");
  if (error) { console.warn("[war] join", error.message); return false; }
  return true;
}

export async function warRecord(pnlPct: number, nearMiss: number, combo: number) {
  const { error } = await supabase.rpc("war_record_pnl", {
    _pnl_pct: pnlPct,
    _near_miss: nearMiss,
    _combo: combo,
  });
  if (error) console.warn("[war] record", error.message);
}

export async function warLeaderboard(sessionId?: string, limit = 10): Promise<WarLeaderRow[]> {
  const { data, error } = await supabase.rpc("war_get_leaderboard", {
    _session_id: sessionId ?? null,
    _limit: limit,
  });
  if (error) { console.warn("[war] lb", error.message); return []; }
  return (data ?? []) as WarLeaderRow[];
}
