// IMPERIAL-SINGULARITY: pure House Edge simulation (no DB). Mirrors server payout math.
// payout_pool = total_pot * (1 - 0.062); winning bettors split proportionally.
import { describe, it, expect } from "vitest";

const HOUSE_EDGE = 0.062;

function simulateRound(totalPot: number, leftPot: number, rightPot: number, winner: "left" | "right") {
  const payoutPool = totalPot * (1 - HOUSE_EDGE);
  const winningPot = winner === "left" ? leftPot : rightPot;
  const houseTake = totalPot - payoutPool;
  // entire payoutPool goes to winners; if winningPot=0 house keeps everything (no winners)
  if (winningPot <= 0) return { houseTake: totalPot, paidOut: 0 };
  return { houseTake, paidOut: payoutPool };
}

function rand(seed: { v: number }) {
  // xorshift32 — deterministic
  let x = seed.v | 0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  seed.v = x | 0;
  return ((x >>> 0) % 1_000_000) / 1_000_000;
}

describe("Imperial Duel House Edge", () => {
  it("converges to 6.2% ±0.2% over 5000 spins (balanced pots)", () => {
    const seed = { v: 0xCAFEBABE };
    let totalIn = 0, totalHouse = 0;
    for (let i = 0; i < 5000; i++) {
      const left = Math.floor(rand(seed) * 5000) + 500;
      const right = Math.floor(rand(seed) * 5000) + 500;
      const winner = rand(seed) < 0.5 ? "left" : "right";
      const total = left + right;
      const { houseTake } = simulateRound(total, left, right, winner);
      totalIn += total;
      totalHouse += houseTake;
    }
    const actual = totalHouse / totalIn;
    expect(actual).toBeGreaterThan(0.060);
    expect(actual).toBeLessThan(0.064);
  });

  it("returns full pot to house when winning side has no bettors", () => {
    const r = simulateRound(1000, 1000, 0, "right");
    expect(r.houseTake).toBe(1000);
    expect(r.paidOut).toBe(0);
  });

  it("payout pool never exceeds total pot", () => {
    for (let i = 0; i < 100; i++) {
      const r = simulateRound(10000, 5000, 5000, "left");
      expect(r.paidOut + r.houseTake).toBeCloseTo(10000, 6);
    }
  });
});
