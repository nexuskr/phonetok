/**
 * Single source of truth for AML withdrawal tiers.
 * Numbers MUST match server-side enforcement in aml RPCs/policies.
 */

export type AmlTier = {
  level: 1 | 2 | 3;
  /** Cumulative withdraw amount upper bound (KRW). null = no upper bound. */
  maxCumulativeKRW: number | null;
  /** Daily withdraw cap suggestion for UI copy. */
  dailyCapKRW: number;
  /** Required verification step. */
  requirement: string;
  /** Short ko/en labels — kept here so UI cannot drift. */
  labelKo: string;
  labelEn: string;
  descKo: string;
  descEn: string;
};

export const AML_TIERS: readonly AmlTier[] = [
  {
    level: 1,
    maxCumulativeKRW: 1_000_000,
    dailyCapKRW: 1_000_000,
    requirement: "PIN + SMS",
    labelKo: "기본 인증",
    labelEn: "Basic",
    descKo: "누적 출금 100만원 미만 — PIN + SMS 인증으로 즉시 통과",
    descEn: "Under ₩1M cumulative — instant PIN + SMS verification",
  },
  {
    level: 2,
    maxCumulativeKRW: 10_000_000,
    dailyCapKRW: 5_000_000,
    requirement: "Real name + selfie",
    labelKo: "실명 + 셀카",
    labelEn: "ID + Selfie",
    descKo: "누적 100만 ~ 1,000만원 — 실명 확인 + 셀카 1장",
    descEn: "₩1M ~ ₩10M cumulative — real name + 1 selfie",
  },
  {
    level: 3,
    maxCumulativeKRW: null,
    dailyCapKRW: 30_000_000,
    requirement: "Documents + 24h review",
    labelKo: "서류 제출",
    labelEn: "Documents",
    descKo: "1,000만원 초과 — 자금세탁방지 서류 + 24시간 검토",
    descEn: "Over ₩10M — AML documents + 24-hour review",
  },
] as const;

/** Returns the AML tier required for a user given their cumulative withdrawn amount. */
export function tierForCumulative(cumulativeKRW: number): AmlTier {
  return (
    AML_TIERS.find(
      (t) => t.maxCumulativeKRW === null || cumulativeKRW < t.maxCumulativeKRW,
    ) ?? AML_TIERS[AML_TIERS.length - 1]
  );
}

/** Returns the tier the user has currently passed (verifications.level). */
export function currentTierByVerificationLevel(level: number | null | undefined): AmlTier {
  const lv = Math.max(1, Math.min(3, level ?? 1)) as 1 | 2 | 3;
  return AML_TIERS.find((t) => t.level === lv) ?? AML_TIERS[0];
}
