// IMPERIAL-SINGULARITY v3.5-H: Tier-5 only — lightning + screen shake + particle storm.
import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

function rand(min: number, max: number) { return min + Math.random() * (max - min); }

export default function MythicThunder({ onDone }: { onDone?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current?.parentElement;
    if (root) {
      root.animate(
        [
          { transform: "translate(0,0)" },
          { transform: "translate(-6px,3px)" },
          { transform: "translate(5px,-4px)" },
          { transform: "translate(-3px,2px)" },
          { transform: "translate(0,0)" },
        ],
        { duration: 600, iterations: 1, easing: "cubic-bezier(.36,.07,.19,.97)" },
      );
    }
    const t = setTimeout(() => onDone?.(), 1800);
    return () => clearTimeout(t);
  }, [onDone]);

  // Generate 5 lightning paths
  const bolts = Array.from({ length: 5 }).map((_, i) => {
    const x = 10 + i * 18 + rand(-4, 4);
    const segs: string[] = [`M${x} 0`];
    let y = 0;
    let cx = x;
    while (y < 100) {
      y += rand(6, 14);
      cx += rand(-7, 7);
      segs.push(`L${cx.toFixed(1)} ${y.toFixed(1)}`);
    }
    return segs.join(" ");
  });

  return (
    <div ref={ref} className="pointer-events-none fixed inset-0 z-[200] degrade:hidden low:hidden overflow-hidden">
      {/* flash */}
      <motion.div className="absolute inset-0 bg-white" initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.85, 0, 0.5, 0] }} transition={{ duration: 0.9 }} />
      {/* lightning */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
        <defs>
          <filter id="glow"><feGaussianBlur stdDeviation="0.6" /></filter>
        </defs>
        {bolts.map((d, i) => (
          <motion.path key={i} d={d} stroke="#fde047" strokeWidth={0.5} fill="none" filter="url(#glow)"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: [0, 1, 0.8, 0] }}
            transition={{ duration: 0.55, delay: i * 0.07, ease: "easeOut" }} />
        ))}
      </svg>
      {/* particle storm — pure transform, GPU only */}
      <div className="absolute inset-0">
        {Array.from({ length: 28 }).map((_, i) => (
          <motion.span key={i}
            className="absolute block w-1 h-1 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(253,224,71,0.9)]"
            style={{ left: `${rand(0, 100)}%`, top: `${rand(0, 100)}%` }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.4, 0], opacity: [0, 1, 0], y: [0, rand(-80, 80)], x: [0, rand(-80, 80)] }}
            transition={{ duration: rand(1.0, 1.6), delay: rand(0, 0.4), ease: "easeOut" }} />
        ))}
      </div>
    </div>
  );
}
