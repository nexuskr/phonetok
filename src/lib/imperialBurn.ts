// IMPERIAL-SINGULARITY v3.5-H: client-side burn rate mirror.
// Authoritative values live in DB (imperial_get_burn_rate / imperial_flywheel_params).
import type { VolatilityTier } from "@/lib/flywheel";

export const BURN = {
  HOUSE_EDGE: 0.26,
  VOL_EXTRA: { calm: 0.008, warm: 0.012, hot: 0.018, surge: 0.024, extreme: 0.032 } as Record<VolatilityTier, number>,
  NEAR_MISS_STRONG: { min: 0.12, max: 0.22 },
} as const;

export function houseEdgeBurnRate(tier?: VolatilityTier): number {
  return BURN.HOUSE_EDGE + (tier ? BURN.VOL_EXTRA[tier] : 0);
}

export function nearMissBurnRate(rng01: number): number {
  const r = Math.max(0, Math.min(1, rng01));
  return BURN.NEAR_MISS_STRONG.min + r * (BURN.NEAR_MISS_STRONG.max - BURN.NEAR_MISS_STRONG.min);
}

export function expectedBurnAmount(base: number, tier?: VolatilityTier): number {
  if (!Number.isFinite(base) || base <= 0) return 0;
  return base * houseEdgeBurnRate(tier);
}
