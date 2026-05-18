/**
 * Phase 4 Sprint 3 — Swipe Gesture Hook
 * --------------------------------------
 * 좌/우/상/하 4방향 스와이프. passive listener.
 */
import { useEffect, useRef } from "react";

type Dir = "left" | "right" | "up" | "down";
type Opts = {
  threshold?: number; // px
  velocity?: number; // px/ms
  onSwipe: (dir: Dir) => void;
  enabled?: boolean;
};

export function useSwipeGesture<T extends HTMLElement = HTMLDivElement>({
  threshold = 50,
  velocity = 0.3,
  onSwipe,
  enabled = true,
}: Opts) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let x0 = 0, y0 = 0, t0 = 0;
    const start = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      x0 = t.clientX; y0 = t.clientY; t0 = e.timeStamp;
    };
    const end = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - x0;
      const dy = t.clientY - y0;
      const dt = Math.max(1, e.timeStamp - t0);
      const ax = Math.abs(dx), ay = Math.abs(dy);
      const v = Math.max(ax, ay) / dt;
      if (Math.max(ax, ay) < threshold || v < velocity) return;
      if (ax > ay) onSwipe(dx > 0 ? "right" : "left");
      else onSwipe(dy > 0 ? "down" : "up");
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchend", end, { passive: true });
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchend", end);
    };
  }, [enabled, threshold, velocity, onSwipe]);
  return ref;
}
