import { useState } from "react";
import { Triangle } from "lucide-react";
import { GlowCard } from "../components/GlowCard";
import { NeonButton } from "../components/NeonButton";
import { ParticleBurst } from "../components/ParticleBurst";
import { ApexFairBadge } from "./ProvablyFairBadge";
import { useApexGame } from "./useApexGame";

const ROWS = 12;
const MULTS = [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33];

export default function PlinkoGame() {
  const [bet, setBet] = useState(100);
  const [bin, setBin] = useState<number | null>(null);
  const [burst, setBurst] = useState(0);
  const { play, loading, last } = useApexGame();

  async function drop() {
    setBin(null);
    const res = await play("plinko", { phon: bet }, { rows: ROWS, risk: "medium" });
    if (!res?.ok) return;
    const b = Number(res.result?.bin ?? 6);
    setBin(b);
    if (Number(res.payout_phon) > bet) setBurst((x) => x + 1);
  }

  return (
    <div className="space-y-5">
      <ParticleBurst trigger={burst} />
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black apex-gradient-text flex items-center gap-2">
          <Triangle className="w-7 h-7 text-primary" /> PLINKO
        </h1>
        <ApexFairBadge hash={last?.server_seed_hash} seed={last?.client_seed} nonce={last?.nonce} />
      </div>

      <GlowCard>
        <div className="p-6 space-y-4">
          <div className="relative h-72 rounded-xl bg-background/70 border border-primary/20 overflow-hidden flex flex-col items-center justify-end p-3">
            <div className="absolute inset-x-0 top-2 flex flex-col items-center gap-1">
              {Array.from({ length: ROWS }).map((_, r) => (
                <div key={r} className="flex gap-2">
                  {Array.from({ length: r + 3 }).map((_, c) => (
                    <span key={c} className="w-1.5 h-1.5 rounded-full bg-primary/40 shadow-[0_0_6px_hsl(var(--apex-neon)/0.5)]" />
                  ))}
                </div>
              ))}
            </div>
            <div className="relative z-10 flex gap-1 w-full justify-center">
              {MULTS.map((m, i) => (
                <div
                  key={i}
                  className={`flex-1 text-center py-1 rounded text-[10px] font-black border ${
                    bin === i
                      ? "border-accent bg-accent/30 apex-text-magenta apex-pulse"
                      : m >= 4 ? "border-primary/30 text-primary" : "border-border text-muted-foreground"
                  }`}
                >{m}x</div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase text-muted-foreground">Bet (PHON)</label>
            <input type="number" min={10} value={bet}
              onChange={(e) => setBet(Math.max(10, Number(e.target.value) || 10))}
              className="mt-1 w-full rounded-lg bg-input border border-border px-3 py-2 text-sm font-bold" />
          </div>

          <NeonButton size="xl" pulse className="w-full" onClick={drop} disabled={loading}>
            {loading ? "DROPPING…" : `DROP · ${bet.toLocaleString()} PHON`}
          </NeonButton>
          <p className="text-center text-[10px] text-muted-foreground">12 rows · Medium risk · House Edge 1.0%</p>
        </div>
      </GlowCard>
    </div>
  );
}
