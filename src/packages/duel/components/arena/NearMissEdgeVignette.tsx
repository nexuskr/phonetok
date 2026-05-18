/**
 * NearMissEdgeVignette — 화면 가장자리 핑크 비네트 (Imperial subtle pattern).
 * intensity > 0.65 에서 페이드 인. side 에 따라 left/right glow 차별화.
 * transform/opacity only, pointer-events-none.
 */
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  intensity: number;
  side?: "left" | "right" | null;
}

export function NearMissEdgeVignette({ intensity, side }: Props) {
  const show = intensity > 0.65;
  const alpha = Math.min(0.75, intensity * 0.85);
  const leftAlpha = side === "left" ? alpha : alpha * 0.35;
  const rightAlpha = side === "right" ? alpha : alpha * 0.35;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="nm-vignette"
          aria-hidden
          className="fixed inset-0 z-[70] pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          style={{
            background: [
              `radial-gradient(60% 100% at 0% 50%, hsl(330 90% 55% / ${leftAlpha}) 0%, transparent 55%)`,
              `radial-gradient(60% 100% at 100% 50%, hsl(330 90% 55% / ${rightAlpha}) 0%, transparent 55%)`,
              `radial-gradient(120% 90% at 50% 50%, transparent 60%, hsl(38 92% 50% / ${alpha * 0.35}) 100%)`,
            ].join(", "),
            willChange: "opacity",
          }}
        >
          {/* Imperial subtle diagonal pattern overlay */}
          <div
            className="absolute inset-0"
            style={{
              opacity: 0.12,
              backgroundImage:
                "repeating-linear-gradient(45deg, hsl(38 92% 60% / 0.6) 0 1px, transparent 1px 14px)",
              mixBlendMode: "overlay",
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default NearMissEdgeVignette;
