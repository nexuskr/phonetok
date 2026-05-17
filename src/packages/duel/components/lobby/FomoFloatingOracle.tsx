/**
 * FomoFloatingOracle — Personalized FOMO 떠다니는 오라클.
 */
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { FomoSignals } from "@pkg/duel";

const TRIGGER_LABEL: Record<string, string> = {
  near_miss_streak: "황제의 운이 가까이",
  win_drought: "승리가 그리워질 때",
  royal_pass_milestone: "황실 패스 임박",
  session_resurrection: "다시 강림하신 폐하",
  heat_surge: "황실이 끓어오릅니다",
};

export function FomoFloatingOracle({ signals, onOpenOracle }: { signals: FomoSignals; onOpenOracle: () => void }) {
  const top = signals.triggers[0];
  return (
    <motion.button
      type="button"
      onClick={onOpenOracle}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 240, damping: 22 }}
      className="fixed z-40 right-3 bottom-20 md:bottom-6 max-w-[260px] text-left rounded-2xl p-3 border border-amber-400/40 bg-gradient-to-br from-[#160a05]/95 to-[#1a0a14]/95 backdrop-blur-xl shadow-[0_18px_42px_-12px_hsl(330_90%_50%/0.45)] active:scale-[0.97] will-change-transform"
      style={{ transform: "translateZ(0)" }}
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex w-7 h-7 rounded-xl grid place-items-center bg-gradient-to-br from-amber-400 to-pink-500 text-[#1a0a05]">
          <Sparkles className="w-3.5 h-3.5" />
        </span>
        <div className="min-w-0">
          <div className="text-[10px] tracking-[0.24em] font-black uppercase text-amber-300/85">Personal Oracle</div>
          <div className="text-[12px] font-bold text-amber-100 truncate">
            FOMO {signals.personalScore}
          </div>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-amber-100/90 break-keep leading-snug">
        {top ? TRIGGER_LABEL[top] : "황제 폐하의 순간이 다가옵니다"}
      </p>
      <div className="mt-2 h-1.5 rounded-full bg-black/55 overflow-hidden">
        <div
          className="h-full"
          style={{
            width: `${signals.personalScore}%`,
            background: "linear-gradient(90deg,#F5C518,#F472B6)",
            boxShadow: "0 0 10px hsl(330 90% 60% / 0.5)",
          }}
        />
      </div>
      <div className="mt-2 text-[10px] text-pink-300/80 tracking-[0.18em] font-black uppercase">
        황실의 검증 오라클 열기 →
      </div>
    </motion.button>
  );
}

export default FomoFloatingOracle;
