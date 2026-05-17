/**
 * Dynamic Threshold — 최근 결과 기반 ±2.2% 보정.
 * 결과는 deterministic (입력 history만 사용) — Groth16 public signal `dynamicOffset` 으로 노출.
 */
const MAX_OFFSET = 0.022;

export interface ThresholdInput {
  recentResults: Array<"left" | "right">; // newest last
  personalHeat: number; // 0..100
}

export function computeThreshold(input: ThresholdInput): { threshold: number; offset: number } {
  const tail = input.recentResults.slice(-10);
  if (tail.length === 0) return { threshold: 0.5, offset: 0 };
  const rights = tail.filter((r) => r === "right").length;
  // Skew threshold toward the side that has lost more, capped at ±2.2%.
  const bias = (rights - tail.length / 2) / tail.length; // -0.5..+0.5
  const heatNorm = (input.personalHeat - 50) / 100;       // -0.5..+0.5
  const raw = (bias * 0.7 + heatNorm * 0.3) * MAX_OFFSET * 2;
  const offset = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, raw));
  return { threshold: 0.5 + offset, offset };
}
