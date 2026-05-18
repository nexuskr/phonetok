/**
 * Phase 4 Sprint 3 — Multiplier Count-Up
 * ---------------------------------------
 * Sprint 2 worker(Float32Array transferable)로 프레임 계산 후
 * requestAnimationFrame 으로 표시. transform: scale 만 사용.
 * Worker 실패 시 cosmetic.ts 가 main-thread fallback 으로 자동 위임.
 */
import { useEffect, useRef, useState } from "react";
import { calcMultiplierFrames } from "@/packages/workers/cosmetic";

type Props = {
  from: number;
  to: number;
  durationMs?: number;
  className?: string;
  format?: (n: number) => string;
};

export function MultiplierCountUp({
  from,
  to,
  durationMs = 900,
  className,
  format,
}: Props) {
  const [value, setValue] = useState(from);
  const elRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    (async () => {
      const frames = Math.max(2, Math.min(120, Math.round(durationMs / 16)));
      const arr = await calcMultiplierFrames(from, to, frames);
      if (cancelled) return;
      let i = 0;
      const tick = () => {
        if (cancelled) return;
        const v = arr[Math.min(i, arr.length - 1)];
        setValue(v);
        const el = elRef.current;
        if (el) {
          // transform-only emphasis
          const peak = Math.min(1.15, 1 + (i / arr.length) * 0.15);
          el.style.transform = `scale(${peak})`;
        }
        i++;
        if (i < arr.length) raf = requestAnimationFrame(tick);
        else if (elRef.current) elRef.current.style.transform = "scale(1)";
      };
      raf = requestAnimationFrame(tick);
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [from, to, durationMs]);

  const text = format ? format(value) : `${value.toFixed(2)}×`;
  return (
    <span
      ref={elRef}
      className={className}
      style={{
        display: "inline-block",
        transition: "transform 80ms linear",
        willChange: "transform",
      }}
    >
      {text}
    </span>
  );
}

export default MultiplierCountUp;
