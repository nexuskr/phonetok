import { useState } from "react";
import { motion, useAnimation, AnimatePresence } from "framer-motion";
import { Gift, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";
import { G } from "@/lib/glossary";

interface Props {
  spunToday: boolean;
  lastAmount: number;
  multiplier: number; // 1.0 or 1.5
  onSpun?: (amount: number) => void;
}

// 8 segments visualised — actual payout is server-decided.
const SEGMENTS = [50, 500, 100, 1000, 200, 5000, 50, 200];

export default function RouletteCard({ spunToday, lastAmount, multiplier, onSpun }: Props) {
  const controls = useAnimation();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<number | null>(spunToday ? lastAmount : null);

  async function spin() {
    if (busy || spunToday) return;
    setBusy(true);
    try {
      // Start a long visual spin immediately for instant feedback
      const spinPromise = controls.start({
        rotate: 360 * 6 + Math.random() * 360,
        transition: { duration: 3.4, ease: [0.17, 0.67, 0.21, 0.99] },
      });

      const { data, error } = await supabase.rpc("spin_daily_roulette" as any);
      if (error) throw error;
      const d = data as any;

      await spinPromise;

      if (d?.already_spun) {
        setResult(d.amount);
        notify.info(G.earnRouletteDone);
        onSpun?.(0);
      } else if (d?.ok) {
        const amount = Number(d.amount ?? 0);
        // Land on the matching segment
        const idx = SEGMENTS.findIndex((v) => v === d.base_amount);
        if (idx >= 0) {
          const segDeg = 360 / SEGMENTS.length;
          const target = 360 * 8 - (idx * segDeg + segDeg / 2);
          await controls.start({
            rotate: target,
            transition: { duration: 0.6, ease: "easeOut" },
          });
        }
        setResult(amount);
        notify.success(`🎰 +${amount.toLocaleString()} PHON`);
        onSpun?.(amount);
      } else {
        notify.error(d?.error ?? "spin_failed");
      }
    } catch (e: any) {
      notify.error(e?.message ?? "spin_failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.12 }}
      className="rounded-2xl border border-amber-400/40 bg-gradient-to-br from-card via-card to-amber-500/5 p-5 flex flex-col gap-4 relative overflow-hidden"
    >
      <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-amber-400/15 blur-3xl" aria-hidden />
      <div className="absolute -left-8 -bottom-8 w-32 h-32 rounded-full bg-pink-500/15 blur-3xl" aria-hidden />

      <header className="flex items-center gap-2 relative">
        <span className="w-9 h-9 rounded-xl bg-amber-400/15 text-amber-300 flex items-center justify-center">
          <Gift className="w-5 h-5" />
        </span>
        <div>
          <div className="text-base font-bold text-foreground">{G.earnRouletteTitle}</div>
          <div className="text-xs text-muted-foreground">{G.earnRouletteSub}</div>
        </div>
      </header>

      {/* Wheel */}
      <div className="relative mx-auto w-40 h-40">
        {/* pointer */}
        <div
          className="absolute left-1/2 -translate-x-1/2 -top-2 w-0 h-0 z-10"
          style={{
            borderLeft: "10px solid transparent",
            borderRight: "10px solid transparent",
            borderTop: "16px solid hsl(var(--primary))",
          }}
          aria-hidden
        />
        <motion.div
          animate={controls}
          className="w-40 h-40 rounded-full border-4 border-amber-300/60 shadow-[0_0_40px_rgba(255,215,0,0.25)] relative"
          style={{
            willChange: "transform",
            transform: "translateZ(0)",
            background:
              "conic-gradient(from 0deg, #FFD700 0 45deg, #FF00AA 45deg 90deg, #FFD700 90deg 135deg, #FF00AA 135deg 180deg, #FFD700 180deg 225deg, #FF00AA 225deg 270deg, #FFD700 270deg 315deg, #FF00AA 315deg 360deg)",
          }}
        >
          {SEGMENTS.map((v, i) => {
            const angle = (360 / SEGMENTS.length) * i + 360 / SEGMENTS.length / 2;
            return (
              <div
                key={i}
                className="absolute left-1/2 top-1/2 text-[10px] font-black text-black"
                style={{
                  transform: `translate(-50%,-50%) rotate(${angle}deg) translateY(-52px) rotate(${-angle}deg)`,
                }}
              >
                {v >= 1000 ? `${v / 1000}K` : v}
              </div>
            );
          })}
          <div className="absolute inset-0 m-auto w-10 h-10 rounded-full bg-card border-2 border-amber-300/60" />
        </motion.div>
      </div>

      {/* Result / CTA */}
      <AnimatePresence mode="wait">
        {result !== null ? (
          <motion.div
            key={result}
            initial={{ opacity: 0, scale: 0.85, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="rounded-xl bg-background/60 border border-amber-400/30 p-3 text-center"
          >
            <div className="text-[10px] text-muted-foreground tracking-widest">{G.earnRouletteResult}</div>
            <div className="text-3xl font-black tabular-nums text-amber-300">
              +{result.toLocaleString()} <span className="text-sm text-foreground/70">PHON</span>
            </div>
            {multiplier > 1 && (
              <div className="text-[11px] text-pink-400 font-bold mt-0.5">VIP ×{multiplier}</div>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <button
        onClick={spin}
        disabled={busy || spunToday}
        className="min-h-[52px] rounded-xl font-black text-base bg-gradient-to-r from-amber-400 to-pink-500 text-black disabled:from-muted/40 disabled:to-muted/40 disabled:text-muted-foreground active:scale-[0.98] transition inline-flex items-center justify-center gap-2 shadow-lg"
      >
        {spunToday ? (
          <>
            <Check className="w-5 h-5" /> {G.earnRouletteDone}
          </>
        ) : busy ? (
          G.earnRouletteSpinning
        ) : (
          G.earnRouletteCta
        )}
      </button>

      {spunToday && (
        <div className="text-[11px] text-muted-foreground text-center">{G.earnRouletteNextIn}</div>
      )}
    </motion.div>
  );
}
