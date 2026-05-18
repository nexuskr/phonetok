/**
 * Phase 4 Sprint 3 — Dynamic Island State Store
 * ----------------------------------------------
 * 상단 캡슐 pill UI 상태 머신. 가벼운 in-memory pub/sub (zustand 없이).
 * App 어디서나 import 해서 trigger 가능.
 *
 *   import { dynamicIsland } from "@/packages/native/useDynamicIsland";
 *   dynamicIsland.show({ kind: "success", text: "출금 완료" });
 */
import { useEffect, useState } from "react";

export type IslandKind = "idle" | "loading" | "success" | "error" | "info";
export type IslandState = {
  kind: IslandKind;
  text?: string;
  /** auto-hide after ms. 0 = manual */
  ttl?: number;
  id: number;
};

let state: IslandState = { kind: "idle", id: 0 };
let nextId = 1;
const subs = new Set<(s: IslandState) => void>();
let hideTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  subs.forEach((cb) => cb(state));
}

export const dynamicIsland = {
  show(opts: Omit<IslandState, "id" | "kind"> & { kind: Exclude<IslandKind, "idle"> }) {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    state = { ...opts, id: nextId++ };
    emit();
    const ttl = opts.ttl ?? 2400;
    if (ttl > 0) {
      hideTimer = setTimeout(() => {
        state = { kind: "idle", id: nextId++ };
        emit();
      }, ttl);
    }
  },
  hide() {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    state = { kind: "idle", id: nextId++ };
    emit();
  },
  get() {
    return state;
  },
};

export function useDynamicIsland(): IslandState {
  const [s, setS] = useState<IslandState>(state);
  useEffect(() => {
    subs.add(setS);
    setS(state);
    return () => { subs.delete(setS); };
  }, []);
  return s;
}
