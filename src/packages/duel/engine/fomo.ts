/**
 * FOMO Engine — Adaptive Global + Personalized Triggers + Variable Reward 5단계.
 */
import type { FomoSignals, PersonalizedTrigger, RewardTier } from "../types";

export interface FomoInput {
  spectators: number;
  jackpotPct: number;
  recentNearMisses: number;     // last 10 rounds
  consecutiveLosses: number;
  royalPassProgress: number;    // 0..100
  minutesSinceLastVisit: number;
  dynamicOffset: number;
  nearMissFlag: boolean;
  threshold: number;
}

export function computeFomo(input: FomoInput): FomoSignals {
  const triggers: PersonalizedTrigger[] = [];
  if (input.recentNearMisses >= 2) triggers.push("near_miss_streak");
  if (input.consecutiveLosses >= 5) triggers.push("win_drought");
  if (input.royalPassProgress >= 90) triggers.push("royal_pass_milestone");
  if (input.minutesSinceLastVisit >= 30) triggers.push("session_resurrection");

  const globalRaw =
    Math.min(1, input.spectators / 1200) * 0.55 +
    Math.min(1, input.jackpotPct / 100) * 0.45;
  const heatVal = Math.min(5, Math.max(1, Math.ceil(globalRaw * 5))) as 1 | 2 | 3 | 4 | 5;
  if (heatVal >= 4) triggers.push("heat_surge");

  const personalScore = Math.min(
    100,
    Math.round(
      input.recentNearMisses * 9 +
        input.consecutiveLosses * 4 +
        Math.max(0, input.royalPassProgress - 50) * 0.6 +
        Math.min(60, input.minutesSinceLastVisit) * 0.35 +
        heatVal * 6,
    ),
  );

  return {
    globalHeat: heatVal,
    personalScore,
    triggers,
    dynamicOffset: input.dynamicOffset,
    nearMissFlag: input.nearMissFlag,
    threshold: input.threshold,
  };
}

/** Variable Reward 5단계 — roll(0..1) → tier. 황실 분포(꼬리 두텁게). */
export function rewardTierFromRoll(roll: number): RewardTier {
  if (roll < 0.62) return "base";
  if (roll < 0.86) return "surge";
  if (roll < 0.965) return "crown";
  if (roll < 0.995) return "empyrean";
  return "divine";
}

export const REWARD_LABEL: Record<RewardTier, string> = {
  base: "황실의 기본 영광",
  surge: "옥좌의 파동",
  crown: "왕관의 광휘",
  empyrean: "천상의 황좌",
  divine: "신성한 대관식",
};

export const HEAT_LABEL: Record<number, string> = {
  1: "고요한 황궁",
  2: "활기찬 알현실",
  3: "뜨거운 대전",
  4: "황실이 끓어오릅니다",
  5: "황좌가 진동합니다",
};
