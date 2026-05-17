/**
 * Near-Miss 판정 — 임계 근처 ±0.018 진입 시 황실 슬로우다운 트리거.
 */
const NEAR_MISS_BAND = 0.018;

export function detectNearMiss(roll: number, threshold: number) {
  const margin = Math.abs(roll - threshold);
  return { nearMiss: margin <= NEAR_MISS_BAND, margin };
}

/** 시각용 slow-down 커브 — 0..1 진행률 → 0..1 eased. */
export function nearMissEase(t: number): number {
  // Heavy ease-out: 마지막 30% 에서 거의 멈춤
  const x = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - x, 4.2);
}
