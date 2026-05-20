/**
 * PR-P1-A — Reward Adapter
 *
 * 백엔드 `award_crown` RPC와 `crown_events` 테이블은 그대로 유지하면서,
 * 프론트 노출 텍스트/이모지/토스트를 PHON 브랜드로 통일하는 단일 진입점.
 *
 * 사용 규칙:
 *  - 새 코드: "Crown"/"👑"/"크라운" 단어 사용 금지. 본 모듈 헬퍼만 호출.
 *  - 기존 src/lib/crown.ts (RPE 토스트 래퍼)는 점차 본 모듈로 흡수.
 *  - DB 컬럼명/RPC명은 백엔드 계약상 변경 불가.
 */
import { notify } from "@/lib/notify";

export type RewardKind = "phon_bonus" | "phon_reward" | "phon_point" | "vip_boost" | "phon_booster";

export const REWARD_LABEL: Record<RewardKind, string> = {
  phon_bonus: "PHON 보너스",
  phon_reward: "PHON 리워드",
  phon_point: "PHON 포인트",
  vip_boost: "VIP 부스트",
  phon_booster: "PHON 부스터",
};

export const PHON_GEM = "💎";

export function formatRewardLabel(kind: RewardKind, amount?: number): string {
  const label = REWARD_LABEL[kind];
  if (typeof amount !== "number") return label;
  return `${PHON_GEM} +${amount.toLocaleString()} ${label}`;
}

/**
 * PHON 보상 토스트 (구 crownToast/awardCrown 토스트 대체).
 * 백엔드 `award_crown` 결과를 PHON 톤으로 사용자에게 노출할 때만 사용.
 */
export function grantPhonReward(amount: number, opts?: { kind?: RewardKind; message?: string }) {
  const kind = opts?.kind ?? "phon_reward";
  notify.success(opts?.message ?? formatRewardLabel(kind, amount));
}

export function grantVipReward(message: string) {
  notify.success(`${PHON_GEM} VIP · ${message}`);
}
