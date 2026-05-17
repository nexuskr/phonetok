/**
 * useDuelTick — rAF 기반 진행률 0→1, near-miss 시 ease-out 강화.
 */
import { useEffect, useRef, useState } from "react";
import { nearMissEase } from "../engine/nearMiss";

export function useDuelTick(active: boolean, durationMs: number, easeStrong: boolean) {
  const [t, setT] = useState(0);
  const start = useRef<number | null>(null);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!active) { setT(0); start.current = null; return; }
    const loop = (ts: number) => {
      if (start.current === null) start.current = ts;
      const linear = Math.min(1, (ts - start.current) / durationMs);
      setT(easeStrong ? nearMissEase(linear) : 1 - Math.pow(1 - linear, 2.4));
      if (linear < 1) raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [active, durationMs, easeStrong]);

  return t;
}
