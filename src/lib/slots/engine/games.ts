// 7 game configurations — distinct symbol economy + paytable + bonus mechanic.
// Numbers tuned via sim (see scripts/slot-sim.ts) to land near RTP 96%.

import type { GameConfig } from "./types";

// Helper: build a paytable [10/J/Q/K/A/p1/p2/p3/p4/wild/scatter]
// matchCount 3,4,5
const pt = (low: number, mid: number, hi: number, top: number) =>
  [
    [low * 0.1, low * 0.3, low * 0.8],   // 0: 10
    [low * 0.1, low * 0.3, low * 0.8],   // 1: J
    [low * 0.15, low * 0.4, low * 1.0],  // 2: Q
    [low * 0.15, low * 0.4, low * 1.0],  // 3: K
    [low * 0.2, low * 0.5, low * 1.2],   // 4: A
    [mid * 0.5, mid * 1.5, mid * 4],     // 5: prem1
    [mid * 0.6, mid * 2.0, mid * 5],     // 6: prem2
    [hi * 0.8, hi * 2.5, hi * 7],        // 7: prem3
    [top * 1.0, top * 4.0, top * 12],    // 8: prem4 (top symbol)
    [0, 0, 0],                           // 9: WILD pays via substitution
    [0, 0, 0],                           // 10: SCATTER pays via bonus trigger
  ] as const;

// shared base symbol weights (cards heavy, premium scarce, scatter rare)
// [10, J, Q, K, A, p1, p2, p3, p4, WILD, SCATTER]
const W_LOW: readonly number[]      = [22, 22, 18, 18, 16, 12, 10, 7, 5, 4, 7];   // many scatters → freq bonus
const W_MID: readonly number[]      = [24, 24, 20, 20, 17, 11, 9, 6, 4, 3, 4];
const W_HIGH: readonly number[]     = [25, 25, 22, 22, 18, 9, 7, 5, 3, 3, 2.5];
const W_VERY_HIGH: readonly number[]= [26, 26, 24, 24, 20, 8, 6, 4, 2.5, 2.5, 1.8];

export const GAMES: GameConfig[] = [
  // ── 1. Cosmic Forge — Sticky Multiplier Constellation ──
  {
    code: "cosmic_forge_5000",
    title: "Cosmic Forge",
    volatility: "high",
    rtpTarget: 0.96,
    maxMultiplier: 5000,
    reels: 5,
    rows: 3,
    symbolWeights: W_HIGH,
    paytable: pt(0.4, 1.0, 2.0, 4.0),
    scatterTrigger: 3,
    bonus: {
      kind: "sticky_multi",
      spins: 10,
      multWeights: [[2, 50], [3, 30], [5, 15], [10, 4], [25, 1]],
      collectChance: 0.18,
      maxCells: 15,
    },
  },
  // ── 2. Neon Tokyo 88 — Hold & Spin ──
  {
    code: "neon_tokyo_88",
    title: "Neon Tokyo 88",
    volatility: "very_high",
    rtpTarget: 0.96,
    maxMultiplier: 8888,
    reels: 5,
    rows: 3,
    symbolWeights: W_VERY_HIGH,
    paytable: pt(0.3, 0.8, 1.6, 3.0),
    scatterTrigger: 3,
    bonus: {
      kind: "hold88",
      spins: 3,
      respinReset: 3,
      coinChance: 0.06,
      coinWeights: [
        [2, 40],
        [4, 25],
        [8, 18],
        [15, 10],
        [40, 4],
        [88, 2],
        ["GRAND", 1],
      ],
      grandValue: 8888,
      cells: 15,
    },
  },
  // ── 3. Pirate's Curse — Crash Cannon ──
  {
    code: "pirates_curse_1500",
    title: "Pirate's Curse",
    volatility: "mid",
    rtpTarget: 0.96,
    maxMultiplier: 1500,
    reels: 5,
    rows: 3,
    symbolWeights: W_MID,
    paytable: pt(0.5, 1.2, 2.5, 5.0),
    scatterTrigger: 3,
    bonus: {
      kind: "crash_cannon",
      growthPerTick: 0.05,        // 5% per tick
      crashHazard: 0.045,          // 4.5% per tick → ~96.7% house edge after auto cashout
      autoCashoutMult: 5.0,        // sim cashout target
    },
  },
  // ── 4. Pharaoh's Vault — Pick & Reveal ──
  {
    code: "pharaohs_vault_2500",
    title: "Pharaoh's Vault",
    volatility: "mid",
    rtpTarget: 0.96,
    maxMultiplier: 2500,
    reels: 5,
    rows: 3,
    symbolWeights: W_MID,
    paytable: pt(0.5, 1.3, 2.7, 5.0),
    scatterTrigger: 3,
    bonus: {
      kind: "pick_reveal",
      picks: 5,
      prizeWeights: [
        [3, 30],
        [8, 25],
        [20, 18],
        [50, 12],
        ["MORE_PICKS", 8],
        [120, 4],
        ["JACKPOT", 2],
        ["STOP", 1],
      ],
      jackpotWeights: [[50, 50], [200, 30], [600, 15], [1500, 4], [2500, 1]],
      morePicksAdd: 2,
    },
  },
  // ── 5. Viking Thunder — Three-Path Free Spins ──
  {
    code: "viking_thunder_4000",
    title: "Viking Thunder",
    volatility: "high",
    rtpTarget: 0.96,
    maxMultiplier: 4000,
    reels: 5,
    rows: 3,
    symbolWeights: W_HIGH,
    paytable: pt(0.4, 1.0, 2.2, 4.5),
    scatterTrigger: 3,
    bonus: {
      kind: "three_path",
      paths: [
        { name: "Asgard", spins: 5, startMult: 3, wildBoostX: 1 },
        { name: "Midgard", spins: 8, startMult: 1, wildBoostX: 0.5 },
        { name: "Helheim", spins: 12, startMult: 1, wildBoostX: 0.3, xbombChance: 0.06 },
      ],
    },
  },
  // ── 6. Aztec Sun — Cluster Tumble ──
  {
    code: "aztec_sun_1200",
    title: "Aztec Sun",
    volatility: "mid",
    rtpTarget: 0.96,
    maxMultiplier: 1200,
    reels: 5,
    rows: 3,
    symbolWeights: W_MID,
    paytable: pt(0.4, 1.0, 2.0, 4.0),
    scatterTrigger: 4,
    bonus: {
      kind: "cluster_tumble",
      spins: 8,
      cellMultLadder: [2, 4, 8, 16, 32, 64],
      tumbleClearMult: 0.6,
    },
  },
  // ── 7. Cherry Sakura — Mission Trail ──
  {
    code: "cherry_sakura_500",
    title: "Cherry Sakura",
    volatility: "low",
    rtpTarget: 0.96,
    maxMultiplier: 500,
    reels: 5,
    rows: 3,
    symbolWeights: W_LOW,
    paytable: pt(0.5, 1.5, 3.0, 6.0),
    scatterTrigger: 3,
    bonus: {
      kind: "mission_trail",
      steps: 100,
      moveDistWeights: [
        [1, 30],
        [2, 30],
        [3, 20],
        [4, 12],
        [5, 8],
      ],
      checkpoints: {
        5: 2,
        15: 6,
        30: 15,
        50: 35,
        80: 100,
        100: "JACKPOT",
      },
    },
  },
];

export const GAMES_BY_CODE: Record<string, GameConfig> = Object.fromEntries(
  GAMES.map((g) => [g.code, g]),
);
