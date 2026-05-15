import { describe, it, expect } from "vitest";
import { splitSum, pickCells } from "@/components/slots/overlays/bonusSplit";

/**
 * Bonus overlay ↔ server payout sync.
 *
 * Each per-game overlay narrates a server-decided total multiplier. The story
 * pieces (sticky cells, coins, picks, ticks…) MUST sum back to the same total
 * the server paid out, to the cent. These tests assert the deterministic
 * decomposer used by every mechanic.
 */

const SEEDS = [1, 7, 42, 99, 31337, 0x600d, 0xbadbeef];
const TOTALS = [1.0, 5.0, 25.5, 100, 1234.56, 8888];

describe("bonus payout decomposition stays exact", () => {
  for (const total of TOTALS) {
    for (const n of [1, 3, 5, 8, 12]) {
      for (const seed of SEEDS) {
        it(`splitSum(${total},${n},${seed}) sums back to total`, () => {
          const parts = splitSum(total, n, seed);
          expect(parts.length).toBe(n);
          const sum = parts.reduce((a, b) => a + b, 0);
          // Round-trip tolerance: cents
          expect(Math.abs(sum - total)).toBeLessThan(0.011);
          for (const p of parts) expect(p).toBeGreaterThan(0);
        });
      }
    }
  }
});

describe("bonus cell picker is deterministic and unique", () => {
  for (const seed of SEEDS) {
    it(`pickCells(15,6,${seed}) returns 6 unique sorted indices`, () => {
      const a = pickCells(15, 6, seed);
      const b = pickCells(15, 6, seed);
      expect(a).toEqual(b);
      expect(new Set(a).size).toBe(a.length);
      expect([...a].sort((x, y) => x - y)).toEqual(a);
      for (const i of a) {
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThan(15);
      }
    });
  }
});

describe("server-payout vs overlay-onComplete invariant", () => {
  // Simulates the OlympusSlot pipeline: overlay onComplete must equal
  // round(bonusMult * bet) within ±1 unit (PHON or chips).
  const cases: Array<[string, number, number]> = [
    ["sticky_multi", 12.5, 100],
    ["hold88", 88, 50],
    ["crash_cannon", 1.83, 200],
    ["pick_reveal", 47, 75],
    ["three_path", 22.4, 100],
    ["cluster_tumble", 31.7, 60],
    ["mission_trail", 18, 40],
  ];
  for (const [kind, mult, bet] of cases) {
    it(`${kind}: overlay total === server payout (mult=${mult}, bet=${bet})`, () => {
      const expected = Math.round(mult * bet);
      const parts = splitSum(expected, 6, kind.length);
      const overlay = Math.round(parts.reduce((a, b) => a + b, 0));
      // The decomposer rounds to cents, slot bets are integers — drift ≤ 1.
      expect(Math.abs(overlay - expected)).toBeLessThanOrEqual(1);
    });
  }
});
