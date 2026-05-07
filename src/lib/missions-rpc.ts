import { supabase } from "@/integrations/supabase/client";
import { loadDB, saveDB } from "@/lib/store";

/**
 * Calls Supabase RPC `settle_mission` and syncs local wallet from the result.
 * Returns the server-authoritative final reward (KRW), or null on failure.
 */
export async function settleMission(missionId: string, isWin: boolean, baseReward: number) {
  const { data, error } = await supabase.rpc("settle_mission", {
    _mission_id: missionId,
    _is_win: isWin,
    _base_reward: baseReward,
  });
  if (error) {
    console.error("[settleMission]", error);
    return null;
  }
  const r = data as any;
  // Sync local DB cache so UI reflects server truth immediately
  const db = loadDB();
  if (db.user) {
    saveDB({
      ...db,
      user: {
        ...db.user,
        balance: Number(r.available_balance ?? db.user.balance),
        todayEarnings: Number(r.today_earned ?? db.user.todayEarnings),
      },
    });
  }
  return {
    finalReward: Number(r.final_reward ?? 0),
    streak: Number(r.streak ?? 0),
    multiplier: Number(r.multiplier ?? 1),
    capRemaining: Number(r.cap_remaining ?? 0),
    availableBalance: Number(r.available_balance ?? 0),
  };
}

/** Refresh wallet balance from server (post-RPC reconciliation). */
export async function refreshWallet() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;
  const { data } = await supabase
    .from("wallet_balances")
    .select("*")
    .eq("user_id", session.user.id)
    .maybeSingle();
  if (!data) return;
  const db = loadDB();
  if (!db.user) return;
  saveDB({
    ...db,
    user: {
      ...db.user,
      balance: Number(data.available_balance ?? 0),
      todayEarnings: Number(data.today_earned ?? 0),
    },
  });
}
