// IMPERIAL-SINGULARITY v3.5-H: per-tier burn reveal sequence.
import { lazy, Suspense, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useImperialThunderWithReverb } from "@/hooks/useImperialThunderWithReverb";
import { tierMeta, type ImperialNftTier } from "@/lib/imperialNft";

const MythicThunder = lazy(() => import("./MythicThunder"));

const TIER_LABEL: Record<ImperialNftTier, string> = {
  0: "Initiate", 1: "Ember", 2: "Flame", 3: "Pyric", 4: "Eternal", 5: "Mythic",
};

export default function BurnRevealOverlay({
  tier, amount, onDone,
}: { tier: ImperialNftTier; amount: number; onDone?: () => void }) {
  const [open, setOpen] = useState(true);
  const meta = tierMeta(tier);
  const { strike } = useImperialThunderWithReverb();

  useEffect(() => {
    strike(tier === 5 ? "mythic" : tier >= 3 ? "normal" : "soft");
    const dur = tier === 5 ? 2400 : tier >= 3 ? 1600 : 1100;
    const t = setTimeout(() => { setOpen(false); onDone?.(); }, dur);
    return () => clearTimeout(t);
  }, [tier, strike, onDone]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-[180] flex items-center justify-center degrade:hidden low:hidden"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          {/* radial backdrop */}
          <div className="absolute inset-0"
            style={{ background: `radial-gradient(circle at center, ${meta.accent}33 0%, transparent 60%)` }} />
          {/* concentric rings */}
          {[0, 1, 2].map((i) => (
            <motion.div key={i}
              className="absolute rounded-full border-2"
              style={{ borderColor: meta.accent, width: 80, height: 80 }}
              initial={{ scale: 0.3, opacity: 0.9 }}
              animate={{ scale: 6 + i * 2, opacity: 0 }}
              transition={{ duration: 1.4, delay: i * 0.18, ease: "easeOut" }} />
          ))}
          {/* center label */}
          <motion.div
            className="relative text-center"
            initial={{ scale: 0.6, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 16 }}
          >
            <div className="text-[10px] tracking-[0.4em] uppercase text-amber-200/80">Imperial Burn</div>
            <div className="font-display font-black text-4xl md:text-5xl mt-1"
                 style={{ color: meta.accent, textShadow: `0 0 24px ${meta.accent}aa` }}>
              {TIER_LABEL[tier]}
            </div>
            <div className="mt-2 text-sm text-amber-100/90 tabular-nums">
              {Math.round(amount).toLocaleString()} PHON 소각
            </div>
          </motion.div>

          {tier === 5 && (
            <Suspense fallback={null}>
              <MythicThunder />
            </Suspense>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
