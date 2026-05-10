import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface PositionTriggers {
  /** TP ROI percent (e.g. 50 = +50% ROI). */
  tpPct?: number;
  /** SL ROI percent (positive number, e.g. 25 = -25% ROI). */
  slPct?: number;
  /** Trailing stop drawdown percent from peak ROI. */
  trailingPct?: number;
  /** Internal: highest ROI observed so far (in percent). */
  peakRoiPct?: number;
}

interface State {
  /** Map<positionId, triggers>. Persisted in localStorage so triggers survive reloads. */
  triggers: Record<string, PositionTriggers>;
  set: (id: string, t: PositionTriggers | undefined) => void;
  update: (id: string, patch: Partial<PositionTriggers>) => void;
  remove: (id: string) => void;
  clear: () => void;
}

/**
 * Client-side trigger store for SL/TP/Trailing.
 * Used by both Paper and Real modes — enforcement runs in the browser
 * via `usePositionTriggerWatcher`.
 */
export const useTriggerStore = create<State>()(
  persist(
    (set) => ({
      triggers: {},
      set: (id, t) => set((s) => {
        const next = { ...s.triggers };
        if (!t) delete next[id]; else next[id] = t;
        return { triggers: next };
      }),
      update: (id, patch) => set((s) => {
        const cur = s.triggers[id] ?? {};
        return { triggers: { ...s.triggers, [id]: { ...cur, ...patch } } };
      }),
      remove: (id) => set((s) => {
        if (!s.triggers[id]) return s;
        const next = { ...s.triggers };
        delete next[id];
        return { triggers: next };
      }),
      clear: () => set({ triggers: {} }),
    }),
    {
      name: "phonara_triggers_v1",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
