/**
 * ComboStreakBurst — 3/5/10 연승 달성 시 화면 중앙에 폭발하는 콤보 카운터.
 * - tier 3 = "TRIPLE", 5 = "PENTA", 10 = "GOD COMBO"
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame } from "lucide-react";

export interface ComboBurstProps {
  combo: number; // 외부 상태
  onShown?: (tier: number) => void;
}

const TIERS = [
  { n: 3, label: "TRIPLE", color: "from-amber-500 to-orange-500" },
  { n: 5, label: "PENTA", color: "from-orange-500 to-rose-500" },
  { n: 10, label: "GOD COMBO", color: "from-fuchsia-500 via-amber-400 to-rose-500" },
];

export default function ComboStreakBurst({ combo, onShown }: ComboBurstProps) {
  const [shown, setShown] = useState<number | null>(null);
  const [seen, setSeen] = useState<Set<number>>(new Set());

  useEffect(() => {
    const tier = TIERS.slice().reverse().find((t) => combo >= t.n && !seen.has(t.n));
    if (!tier) return;
    setShown(tier.n);
    setSeen((s) => new Set(s).add(tier.n));
    onShown?.(tier.n);
    const t = setTimeout(() => setShown(null), 1200);
    return () => clearTimeout(t);
  }, [combo, seen, onShown]);

  // combo 0으로 리셋되면 seen 도 초기화
  useEffect(() => {
    if (combo === 0 && seen.size > 0) setSeen(new Set());
  }, [combo, seen.size]);

  const tier = TIERS.find((t) => t.n === shown);

  return (
    <AnimatePresence>
      {tier && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5, rotate: -8 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          exit={{ opacity: 0, scale: 1.6, y: -40 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
          className="pointer-events-none fixed inset-0 z-[86] flex items-center justify-center"
        >
          <div className={`px-8 py-5 rounded-3xl bg-gradient-to-br ${tier.color} shadow-2xl border-2 border-white/30`}>
            <div className="flex items-center gap-3">
              <Flame className="w-9 h-9 text-white drop-shadow" />
              <div className="text-white">
                <div className="font-display font-black text-3xl tracking-wide drop-shadow">{tier.label}</div>
                <div className="text-xs font-bold opacity-90">×{combo} COMBO</div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
