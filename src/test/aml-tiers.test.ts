/**
 * AML tier baseline test — guarantees the UI-side AML_TIERS constant
 * stays in sync with the documented thresholds. If a server-side
 * threshold ever moves, both this test and the constant must change
 * together (single source of truth).
 */
import { describe, it, expect } from "vitest";
import { AML_TIERS, tierForCumulative, currentTierByVerificationLevel } from "@/lib/aml-tiers";

describe("AML tiers — single source of truth", () => {
  it("has exactly 3 levels in increasing order", () => {
    expect(AML_TIERS).toHaveLength(3);
    expect(AML_TIERS.map((t) => t.level)).toEqual([1, 2, 3]);
  });

  it("preserves canonical thresholds (1M / 10M / unlimited)", () => {
    expect(AML_TIERS[0].maxCumulativeKRW).toBe(1_000_000);
    expect(AML_TIERS[1].maxCumulativeKRW).toBe(10_000_000);
    expect(AML_TIERS[2].maxCumulativeKRW).toBeNull();
  });

  it("tierForCumulative bucketing", () => {
    expect(tierForCumulative(0).level).toBe(1);
    expect(tierForCumulative(999_999).level).toBe(1);
    expect(tierForCumulative(1_000_000).level).toBe(2);
    expect(tierForCumulative(9_999_999).level).toBe(2);
    expect(tierForCumulative(10_000_000).level).toBe(3);
    expect(tierForCumulative(50_000_000).level).toBe(3);
  });

  it("currentTierByVerificationLevel clamps", () => {
    expect(currentTierByVerificationLevel(0).level).toBe(1);
    expect(currentTierByVerificationLevel(1).level).toBe(1);
    expect(currentTierByVerificationLevel(2).level).toBe(2);
    expect(currentTierByVerificationLevel(3).level).toBe(3);
    expect(currentTierByVerificationLevel(99).level).toBe(3);
    expect(currentTierByVerificationLevel(null).level).toBe(1);
  });
});
