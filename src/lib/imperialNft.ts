// IMPERIAL-SINGULARITY v3.5-H: NFT tier metadata mirror.
export type ImperialNftTier = 0 | 1 | 2 | 3 | 4 | 5;

export const NFT_TIERS = [
  { tier: 0, name: "Initiate",            thresholdPhon: 0,         revShareBps: 0,   yieldBoostBps: 0,    govWeight: 0, accent: "#6b7280" },
  { tier: 1, name: "Ember Witness",       thresholdPhon: 1_000,     revShareBps: 5,   yieldBoostBps: 25,   govWeight: 1, accent: "#f59e0b" },
  { tier: 2, name: "Flame Sovereign",     thresholdPhon: 25_000,    revShareBps: 15,  yieldBoostBps: 75,   govWeight: 3, accent: "#f97316" },
  { tier: 3, name: "Pyric Marshal",       thresholdPhon: 250_000,   revShareBps: 40,  yieldBoostBps: 200,  govWeight: 8, accent: "#dc2626" },
  { tier: 4, name: "Eternal Sacrifice",   thresholdPhon: 2_500_000, revShareBps: 100, yieldBoostBps: 500,  govWeight: 21, accent: "#a855f7" },
  { tier: 5, name: "Imperial Ascendant",  thresholdPhon: 25_000_000,revShareBps: 250, yieldBoostBps: 1200, govWeight: 55, accent: "#fde047" },
] as const;

export function tierFor(lifetime: number): ImperialNftTier {
  for (let i = NFT_TIERS.length - 1; i >= 0; i--) {
    if (lifetime >= NFT_TIERS[i].thresholdPhon) return NFT_TIERS[i].tier as ImperialNftTier;
  }
  return 0;
}

export function nextThreshold(lifetime: number): { nextTier: ImperialNftTier; remaining: number } | null {
  const cur = tierFor(lifetime);
  if (cur >= 5) return null;
  const next = NFT_TIERS[cur + 1];
  return { nextTier: next.tier as ImperialNftTier, remaining: Math.max(0, next.thresholdPhon - lifetime) };
}

export function tierMeta(tier: ImperialNftTier) {
  return NFT_TIERS[tier];
}
