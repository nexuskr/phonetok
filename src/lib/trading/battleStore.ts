import { useSyncExternalStore } from "react";

export type Side = "long" | "short";
export type BattlePhase = "idle" | "armed" | "fighting" | "result";

export type BattleState = {
  phase: BattlePhase;
  side: Side | null;
  symbol: string;
  size: number;       // USDT
  entryPrice: number;
  tpPct: number;
  slPct: number;
  startedAt: number;
  resolvedAt: number | null;
  result: "win" | "loss" | "near_miss" | null;
  pnlPct: number;
};

const initial: BattleState = {
  phase: "idle",
  side: null,
  symbol: "BTCUSDT",
  size: 100,
  entryPrice: 0,
  tpPct: 1.0,
  slPct: 0.6,
  startedAt: 0,
  resolvedAt: null,
  result: null,
  pnlPct: 0,
};

let state: BattleState = initial;
const listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }

export const battleStore = {
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  getSnapshot() { return state; },
  start(opts: { side: Side; symbol: string; size: number; entryPrice: number; tpPct?: number; slPct?: number }) {
    state = {
      ...state,
      phase: "fighting",
      side: opts.side,
      symbol: opts.symbol,
      size: opts.size,
      entryPrice: opts.entryPrice,
      tpPct: opts.tpPct ?? 1.0,
      slPct: opts.slPct ?? 0.6,
      startedAt: Date.now(),
      resolvedAt: null,
      result: null,
      pnlPct: 0,
    };
    emit();
  },
  updatePnl(pnlPct: number) {
    if (state.phase !== "fighting") return;
    state = { ...state, pnlPct };
    if (pnlPct >= state.tpPct) {
      state = { ...state, phase: "result", result: "win", resolvedAt: Date.now() };
    } else if (pnlPct <= -state.slPct) {
      state = { ...state, phase: "result", result: "loss", resolvedAt: Date.now() };
    }
    emit();
  },
  resolve(result: "win" | "loss" | "near_miss") {
    state = { ...state, phase: "result", result, resolvedAt: Date.now() };
    emit();
  },
  reset() {
    state = { ...initial };
    emit();
  },
};

export function useBattleStore() {
  return useSyncExternalStore(battleStore.subscribe, battleStore.getSnapshot, battleStore.getSnapshot);
}
