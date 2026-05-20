import type { Tier } from "@/lib/store";

type PowerNftLevel = "bronze" | "gold" | "diamond";

const TIER_TO_LEVEL: Record<Tier, number> = {
  NORMAL: 0,
  VIP: 1,
  GOD: 2,
  EMPIRE: 3,
};

const NFT_TO_LEVEL: Record<PowerNftLevel, number> = {
  bronze: 1,
  gold: 2,
  diamond: 3,
};

export function vipLevelFromTier(tier?: Tier | null): number {
  if (!tier) return 0;
  return TIER_TO_LEVEL[tier] ?? 0;
}

export function vipLevelFromNft(level?: string | null): number {
  if (!level) return 0;
  return NFT_TO_LEVEL[level as PowerNftLevel] ?? 0;
}

export function formatVipLevel(level: number, options?: { short?: boolean }): string {
  const safeLevel = Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 0;
  return options?.short ? `VIP L${safeLevel}` : `VIP Level ${safeLevel}`;
}

export function formatVipLevelFromTier(tier?: Tier | null, options?: { short?: boolean }): string {
  return formatVipLevel(vipLevelFromTier(tier), options);
}

export function formatVipLevelFromNft(level?: string | null, options?: { short?: boolean }): string {
  return formatVipLevel(vipLevelFromNft(level), options);
}