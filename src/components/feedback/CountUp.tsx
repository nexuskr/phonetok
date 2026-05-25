import { useEffect, useRef, useState } from "react";

export default function CountUp({ value, duration = 800, className }: { value: number; duration?: number; className?: string }) {
  const [display, setDisplay] = useState(value);
  const start = useRef(value);
  useEffect(() => {
    const from = start.current;
    const to = value;
    if (from === to) return;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
      else start.current = to;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span className={className}>{display.toLocaleString("ko-KR")}</span>;
}
