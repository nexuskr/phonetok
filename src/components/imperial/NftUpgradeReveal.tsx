// IMPERIAL-SINGULARITY v3.5-H: NFT tier upgrade cinematic.
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { tierMeta, type ImperialNftTier } from "@/lib/imperialNft";

export default function NftUpgradeReveal({
  fromTier, toTier, onDone,
}: { fromTier: ImperialNftTier; toTier: ImperialNftTier; onDone?: () => void }) {
  const [open, setOpen] = useState(true);
  const meta = tierMeta(toTier);

  useEffect(() => {
    const t = setTimeout(() => { setOpen(false); onDone?.(); }, 3600);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="pointer-events-auto fixed inset-0 z-[190] flex items-center justify-center bg-black/70 backdrop-blur-md degrade:hidden"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => { setOpen(false); onDone?.(); }}
        >
          {/* Golden rift */}
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{
              width: 4, height: "120vh",
              background: `linear-gradient(180deg, transparent, ${meta.accent}, transparent)`,
              boxShadow: `0 0 80px 30px ${meta.accent}66`,
            }}
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: [0, 1, 1, 0.4] }}
            transition={{ duration: 2.4, ease: "easeOut" }}
          />
          {/* Crown particles */}
          {Array.from({ length: 18 }).map((_, i) => {
            const a = (i / 18) * Math.PI * 2;
            return (
              <motion.div key={i}
                className="absolute w-2 h-2 rounded-full"
                style={{
                  background: meta.accent,
                  boxShadow: `0 0 14px ${meta.accent}`,
                  left: "50%", top: "50%",
                }}
                initial={{ x: 0, y: 0, opacity: 0 }}
                animate={{ x: Math.cos(a) * 260, y: Math.sin(a) * 260, opacity: [0, 1, 0] }}
                transition={{ duration: 2.0, delay: 0.5 + (i % 6) * 0.04, ease: "easeOut" }}
              />
            );
          })}
          {/* Center plate */}
          <motion.div
            className="relative text-center px-8 py-10 rounded-2xl border"
            style={{
              borderColor: meta.accent + "aa",
              background: `linear-gradient(135deg, ${meta.accent}11, transparent 60%)`,
              boxShadow: `0 0 60px ${meta.accent}55, inset 0 0 30px ${meta.accent}22`,
            }}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.6, type: "spring", stiffness: 200, damping: 18 }}
          >
            <div className="text-[10px] tracking-[0.5em] uppercase text-amber-200/80">Imperial Ascension</div>
            <div className="mt-3 font-display font-black text-4xl md:text-6xl tracking-tight"
                 style={{ color: meta.accent, textShadow: `0 0 28px ${meta.accent}` }}>
              {meta.name}
            </div>
            <div className="mt-3 text-xs text-amber-100/70">
              Tier {fromTier} → <span className="text-amber-200 font-bold">Tier {toTier}</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-[10px] text-amber-100/80">
              <div><div className="opacity-60 uppercase">Rev Share</div><div className="font-bold text-amber-200">{(meta.revShareBps / 100).toFixed(2)}%</div></div>
              <div><div className="opacity-60 uppercase">Yield</div><div className="font-bold text-amber-200">+{(meta.yieldBoostBps / 100).toFixed(2)}%</div></div>
              <div><div className="opacity-60 uppercase">Gov Weight</div><div className="font-bold text-amber-200">{meta.govWeight}×</div></div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
