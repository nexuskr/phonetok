/**
 * Imperial Crash — domain types (presentation layer only).
 * Money flow stays on the existing `@/lib/crash` RPC wrappers; this module
 * is a typed contract for UI/engine/store so other games can adopt the
 * same shape.
 */
import { z } from "zod";

export const CrashPhase = z.enum(["idle", "pending", "running", "crashed"]);
export type CrashPhase = z.infer<typeof CrashPhase>;

export const CrashRound = z.object({
  id: z.string().nullable(),
  phase: CrashPhase,
  startedAt: z.number().nullable(),
  lastCrash: z.number().nullable(),
  serverHash: z.string().nullable().optional(),
});
export type CrashRound = z.infer<typeof CrashRound>;

export const BetTicket = z.object({
  roundId: z.string(),
  bet: z.number().positive(),
  autoCashout: z.number().min(1.01).nullable(),
  bonusMult: z.number().positive().default(1),
  placedAt: z.number(),
});
export type BetTicket = z.infer<typeof BetTicket>;

export const LivePlayer = z.object({
  nick: z.string(),
  bet: z.number().positive(),
  cashedAt: z.number().nullable(),
  multiplier: z.number().nullable(),
});
export type LivePlayer = z.infer<typeof LivePlayer>;

export const HistoryEntry = z.object({
  id: z.string(),
  multiplier: z.number().positive(),
  endedAt: z.string(),
});
export type HistoryEntry = z.infer<typeof HistoryEntry>;

export const CRASH_EVENTS = {
  betPlaced: "imperial-crash:bet-placed",
  cashed: "imperial-crash:cashed",
  crashed: "imperial-crash:crashed",
} as const;
