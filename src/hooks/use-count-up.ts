import { useEffect, useRef, useState } from "react";

/**
 * Lightweight rAF count-up. Mobile-friendly:
 * - Skips animation when delta is small (< 0.5%) to avoid 5+ rAF in parallel.
 * - Respects prefers-reduced-motion (instant set).
 * - Pauses while document is hidden.
 */
export function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;
    const delta = Math.abs(target - from);
    const base = Math.max(1, Math.abs(from));
    const tiny = delta / base < 0.005; // < 0.5% change → skip rAF

    if (reduced || tiny || target === from) {
      setVal(target);
      fromRef.current = target;
      return;
    }
    if (typeof document !== "undefined" && document.hidden) {
      setVal(target);
      fromRef.current = target;
      return;
    }

    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setVal(from + (target - from) * e);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
      else fromRef.current = target;
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return val;
}
