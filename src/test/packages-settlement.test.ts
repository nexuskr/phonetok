import { describe, it, expect } from "vitest";
import { PACKAGES } from "@/lib/store";

/**
 * vFinal+ 정산 정합 테스트
 * - 모든 유료 패키지 totalReturn은 dailyReturn * duration 의 ±25% 내 (1~3일 가속/Empire Day 보너스 허용)
 * - ROI(totalReturn / price)는 1.5 이하 (Phantom 50일 별도 라인 포함)
 * - dailyReturn / totalReturn / duration / price 는 모두 양의 정수
 */
describe("PACKAGES vFinal+ settlement integrity", () => {
  const paid = PACKAGES.filter((p) => p.tier !== "FREE");

  it("모든 유료 패키지: 가격/일정산/기간/총수령은 양의 정수", () => {
    for (const p of paid) {
      expect(p.price, `${p.id} price`).toBeGreaterThan(0);
      expect(p.dailyReturn, `${p.id} daily`).toBeGreaterThan(0);
      expect(p.duration, `${p.id} duration`).toBeGreaterThan(0);
      expect(p.totalReturn, `${p.id} total`).toBeGreaterThan(0);
      expect(Number.isInteger(p.price), `${p.id} price int`).toBe(true);
      expect(Number.isInteger(p.dailyReturn), `${p.id} daily int`).toBe(true);
      expect(Number.isInteger(p.totalReturn), `${p.id} total int`).toBe(true);
    }
  });

  it("dailyReturn × duration ≈ totalReturn (±25% · 첫 3일 가속/Empire Day 허용)", () => {
    for (const p of paid) {
      const baseline = p.dailyReturn * p.duration;
      const ratio = p.totalReturn / baseline;
      expect(ratio, `${p.id} ratio`).toBeGreaterThan(0.8);
      expect(ratio, `${p.id} ratio`).toBeLessThan(1.25);
    }
  });

  it("ROI(totalReturn / price) ≤ 1.5 — 유사수신 회피 라인", () => {
    for (const p of paid) {
      const roi = p.totalReturn / p.price;
      expect(roi, `${p.id} ROI`).toBeLessThanOrEqual(1.5);
    }
  });

  it("vFinal+ 가격/총수령 스냅샷 — 직전 합의값 유지", () => {
    const expected: Record<string, { price: number; total: number; duration: number }> = {
      easy_starter: { price: 29_000,     total: 55_000,     duration: 30 },
      easy_50:      { price: 390_000,    total: 720_000,    duration: 30 },
      easy_150:     { price: 1_290_000,  total: 2_100_000,  duration: 30 },
      empire:       { price: 9_900_000,  total: 15_000_000, duration: 30 },
      empire_elite: { price: 17_900_000, total: 27_000_000, duration: 30 },
      phantom:      { price: 35_000_000, total: 45_500_000, duration: 50 },
    };
    for (const [id, exp] of Object.entries(expected)) {
      const p = PACKAGES.find((x) => x.id === id);
      expect(p, `${id} exists`).toBeDefined();
      expect(p!.price, `${id} price`).toBe(exp.price);
      expect(p!.totalReturn, `${id} total`).toBe(exp.total);
      expect(p!.duration, `${id} duration`).toBe(exp.duration);
    }
  });
});
