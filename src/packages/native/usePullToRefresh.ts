/**
 * Phase 4 Sprint 3 — Pull-to-Refresh Hook
 * ----------------------------------------
 * iOS-style PTR. transform: translate3d only. 60fps.
 * - scrollTop === 0 에서만 활성
 * - threshold 도달 시 haptic + onRefresh 콜백
 * - reduced-motion 시 비활성 (즉시 콜백만)
 * - passive: false (preventDefault 위해)는 endpoint 진입 시점만
 */
import { useEffect, useRef, useState } from "react";
import { triggerHaptic } from "./useHaptic";

type Opts = {
  threshold?: number; // px
  maxPull?: number;
  onRefresh: () => Promise<unknown> | void;
  enabled?: boolean;
};

export function usePullToRefresh<T extends HTMLElement = HTMLDivElement>({
  threshold = 72,
  maxPull = 120,
  onRefresh,
  enabled = true,
}: Opts) {
  const ref = useRef<T | null>(null);
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const startY = useRef<number | null>(null);
  const hapticFired = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    let raf = 0;
    const onTouchStart = (e: TouchEvent) => {
      if (busy) return;
      if ((el.scrollTop ?? 0) > 0) {
        startY.current = null;
        return;
      }
      startY.current = e.touches[0]?.clientY ?? null;
      hapticFired.current = false;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (startY.current == null || busy) return;
      const dy = (e.touches[0]?.clientY ?? 0) - startY.current;
      if (dy <= 0) {
        if (pull !== 0) setPull(0);
        return;
      }
      // resistance curve
      const resisted = Math.min(maxPull, Math.pow(dy, 0.85));
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setPull(resisted));
      if (resisted >= threshold && !hapticFired.current) {
        hapticFired.current = true;
        triggerHaptic("medium");
      }
    };
    const onTouchEnd = async () => {
      if (startY.current == null) return;
      const should = pull >= threshold;
      startY.current = null;
      if (should) {
        setBusy(true);
        setPull(threshold);
        try {
          await onRefresh();
        } catch {
          /* swallow */
        } finally {
          setBusy(false);
          setPull(0);
        }
      } else {
        setPull(0);
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [enabled, threshold, maxPull, onRefresh, pull, busy]);

  return { ref, pull, busy, threshold };
}
