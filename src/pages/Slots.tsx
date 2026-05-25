import { useState } from "react";
import { motion } from "framer-motion";
import { Gem, Zap } from "lucide-react";
import { rewardBurst } from "@/components/feedback/RewardBurst";
import { notify } from "@/lib/notify";
import CountUp from "@/components/feedback/CountUp";
import { useBalance } from "@/hooks/use-profile";

const SYMS = ["⚡", "👑", "💎", "🍀", "🔥", "🌟"];
const BET = 1000;

function spinReel() {
  return SYMS[Math.floor(Math.random() * SYMS.length)];
}

export default function Slots() {
  const { data: balance = 0 } = useBalance();
  const [reels, setReels] = useState(["⚡", "👑", "💎", "🍀", "🌟"]);
  const [spinning, setSpinning] = useState(false);
  const [lastWin, setLastWin] = useState(0);

  const spin = () => {
    if (spinning) return;
    if (balance < BET) return notify.error("잔액 부족");
    setSpinning(true);
    setLastWin(0);
    // anticipation: stagger
    const result = [spinReel(), spinReel(), spinReel(), spinReel(), spinReel()];
    [0, 1, 2, 3, 4].forEach((i) => {
      setTimeout(() => {
        setReels((prev) => { const c = [...prev]; c[i] = result[i]; return c; });
        if (i === 4) {
          // count matches
          const counts: Record<string, number> = {};
          result.forEach((s) => { counts[s] = (counts[s] || 0) + 1; });
          const max = Math.max(...Object.values(counts));
          let win = 0;
          if (max === 5) win = BET * 100;
          else if (max === 4) win = BET * 15;
          else if (max === 3) win = BET * 4;
          if (win > 0) {
            setLastWin(win);
            rewardBurst();
            notify.reward(win);
          }
          setSpinning(false);
        }
      }, 400 + i * 280);
    });
  };

  return (
    <main className="container mx-auto px-4 pt-5 pb-10 space-y-5 max-w-2xl">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-black flex items-center gap-2">
          <Gem className="h-6 w-6 text-primary" /> Olympus 1000
        </h1>
        <span className="text-xs px-2 py-1 rounded-full bg-secondary/20 text-secondary font-bold">SIM</span>
      </header>

      <div className="text-right text-sm text-muted-foreground">
        잔액 <span className="text-primary font-bold"><CountUp value={balance} /> PHON</span>
      </div>

      <motion.section
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="rounded-3xl p-6 bg-gradient-to-br from-primary/20 via-card to-pink/15 border border-primary/30 shadow-[var(--glow-gold)]"
      >
        <div className="grid grid-cols-5 gap-2">
          {reels.map((s, i) => (
            <motion.div
              key={`${i}-${s}`}
              initial={{ rotateX: -180, opacity: 0 }} animate={{ rotateX: 0, opacity: 1 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="aspect-square rounded-2xl bg-background border border-primary/30 grid place-items-center text-5xl"
            >
              {s}
            </motion.div>
          ))}
        </div>
        {lastWin > 0 && (
          <div className="mt-4 text-center font-black text-2xl text-primary animate-pulse">
            🎉 +{lastWin.toLocaleString()} PHON
          </div>
        )}
      </motion.section>

      <button
        onClick={spin} disabled={spinning}
        className="w-full py-5 rounded-2xl bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-black text-xl shadow-[var(--glow-gold)] active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <Zap className="h-6 w-6" />
        {spinning ? "스핀 중…" : `스핀 (${BET.toLocaleString()} PHON)`}
      </button>

      <div className="text-xs text-muted-foreground text-center">
        3개 매치 ×4 · 4개 매치 ×15 · 잭팟 ×100
      </div>
    </main>
  );
}
