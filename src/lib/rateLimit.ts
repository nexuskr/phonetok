/**
 * 클라이언트 측 rate limit 가드.
 *
 * 백엔드의 enforce_rate_limit RPC를 호출하여 분당 호출 횟수를 검증한다.
 * - 통과: 그대로 반환
 * - 초과: 백엔드가 anomaly_events에 기록하고 예외를 던지므로 호출자가 catch 가능
 *
 * 사용 예:
 *   await assertRateLimit("mission_claim", 30);
 *   await supabase.rpc("claim_daily_attendance");
 */
import { supabase } from "@/integrations/supabase/client";

export async function assertRateLimit(scope: string, maxPerMin = 30): Promise<void> {
  const { error } = await supabase.rpc("enforce_rate_limit", {
    _scope: scope,
    _max_per_min: maxPerMin,
  });
  if (error) {
    throw new Error(error.message || "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
  }
}

/** Wallet/지갑 영향 RPC (보상 수령 등): 분당 20회 */
export const RL_WALLET = { scope: "wallet", max: 20 } as const;
/** 미션/출석/퀘스트 클레임: 분당 30회 */
export const RL_MISSION = { scope: "mission_claim", max: 30 } as const;
/** 인증·디바이스 관련: 분당 30회 */
export const RL_AUTH = { scope: "auth", max: 30 } as const;
