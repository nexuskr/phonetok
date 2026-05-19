/**
 * useCrashStore — Zustand presentation store for Imperial Crash.
 * NEVER calls money-flow RPCs directly. Pages mutate this store after the
 * existing `@/lib/crash` wrappers resolve, so money flow stays git-diff=0.
 */
import { create } from "zustand";
import type { BetTicket, CrashPhase, HistoryEntry, LivePlayer } from "../types";

interface CrashState {
  phase: CrashPhase;
  multiplier: number;
  roundId: string | null;
  startedAt: number | null;
  lastCrash: number | null;
  ticket: BetTicket | null;
  history: HistoryEntry[];
  players: LivePlayer[];
  pf: { hash: string | null; seed: string | null };
  // actions
  setRound: (p: Partial<Pick<CrashState, "phase" | "roundId" | "startedAt" | "lastCrash">>) => void;
  setMultiplier: (m: number) => void;
  placeTicket: (t: BetTicket) => void;
  clearTicket: () => void;
  pushHistory: (h: HistoryEntry) => void;
  setPlayers: (p: LivePlayer[]) => void;
  setPf: (pf: Partial<CrashState["pf"]>) => void;
  reset: () => void;
}

const INITIAL = {
  phase: "idle" as CrashPhase,
  multiplier: 1,
  roundId: null,
  startedAt: null,
  lastCrash: null,
  ticket: null,
  history: [],
  players: [],
  pf: { hash: null, seed: null },
};

export const useCrashStore = create<CrashState>((set) => ({
  ...INITIAL,
  setRound: (p) => set((s) => ({ ...s, ...p })),
  setMultiplier: (m) => set({ multiplier: m }),
  placeTicket: (t) => set({ ticket: t }),
  clearTicket: () => set({ ticket: null }),
  pushHistory: (h) =>
    set((s) => ({ history: [h, ...s.history].slice(0, 50) })),
  setPlayers: (players) => set({ players }),
  setPf: (pf) => set((s) => ({ pf: { ...s.pf, ...pf } })),
  reset: () => set({ ...INITIAL }),
}));
