import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

export interface PulseEvent {
  id: string;
  xPct: number; // 0..100
  yPct: number; // 0..100
  tone?: "gold" | "cyan";
}

/**
 * Renders short-lived ring pulses over the auth backdrop, one per live-feed event.
 * Pulses self-prune after ~1.8s.
 */
export function LiveFeedPulses({ events }: { events: PulseEvent[] }) {
  const reduce = useReducedMotion();
  const [visible, setVisible] = useState<PulseEvent[]>([]);

  useEffect(() => {
    if (!events.length) return;
    setVisible((prev) => [...prev.slice(-12), ...events].slice(-16));
    const t = setTimeout(() => {
      setVisible((prev) => prev.filter((p) => !events.some((e) => e.id === p.id)));
    }, 1800);
    return () => clearTimeout(t);
  }, [events]);

  return (
    <div className="pointer-events-none absolute inset-0">
      <AnimatePresence>
        {visible.map((p) => {
          const color =
            p.tone === "cyan"
              ? "hsl(var(--secondary))"
              : "hsl(var(--gold))";
          return (
            <motion.span
              key={p.id}
              initial={{ opacity: 0.9, scale: 0.4 }}
              animate={reduce ? { opacity: 0.5, scale: 1 } : { opacity: 0, scale: 3.2 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0.2 : 1.6, ease: "easeOut" }}
              className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                left: `${p.xPct}%`,
                top: `${p.yPct}%`,
                boxShadow: `0 0 0 2px ${color}, 0 0 24px ${color}`,
                background: color,
              }}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export default LiveFeedPulses;
