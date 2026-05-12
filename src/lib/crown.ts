// PR-3: Crown award client wrapper + Reward Prediction Error toast.
// Always call via this wrapper so RPE toast and idempotency dedupe work consistently.
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";

export type CrownEventType =
  | "practice_win"
  | "first_win"
  | "big_win"
  | "streak"
  | "mission"
  | "trade_close"
  | "share"
  | "viral"
  | "checkin";

export type AwardResult = {
  awarded: number;
  expected: number;
  rpe: number;
  variance?: number;
  level_mult?: number;
  streak_mult?: number;
  type_mult?: number;
  level: number;
  level_up?: boolean;
  duplicate?: boolean;
};

export async function awardCrown(
  type: CrownEventType,
  base: number,
  opts: { meta?: Record<string, any>; dedupeKey?: string; silent?: boolean } = {}
): Promise<AwardResult | null> {
  const { data, error } = await supabase.rpc("award_crown", {
    _type: type,
    _base: Math.max(0, Math.min(10000, Math.round(base))),
    _meta: opts.meta ?? {},
    _dedupe_key: opts.dedupeKey ?? null,
  });
  if (error) {
    if (error.message?.includes("rate_limited")) {
      // silent — too fast
      return null;
    }
    notify.error("Crown 지급 실패", { description: error.message });
    return null;
  }
  const r = data as unknown as AwardResult;
  if (r.duplicate || opts.silent) return r;

  // Reward Prediction Error toast — bigger surprise = bigger dopamine
  const ratio = r.rpe;
  let title = `+${r.awarded.toLocaleString()} Crown`;
  if (ratio >= 0.8)      title = `🔥 JACKPOT +${r.awarded.toLocaleString()} Crown`;
  else if (ratio >= 0.3) title = `✨ 보너스 +${r.awarded.toLocaleString()} Crown`;
  else if (ratio <= -0.3) title = `+${r.awarded.toLocaleString()} Crown (다음을 노려보세요)`;

  notify.success(title, {
    description: r.level_up
      ? `🎉 Empire Level ${r.level} 승급!`
      : `예측 ${r.expected.toLocaleString()} · 실제 ${r.awarded.toLocaleString()} (RPE ${(ratio * 100).toFixed(0)}%)`,
  });

  return r;
}
