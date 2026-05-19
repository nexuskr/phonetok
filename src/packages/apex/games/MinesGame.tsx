import { useState } from "react";
import { Bomb, Gem } from "lucide-react";
import { GlowCard } from "../components/GlowCard";
import { NeonButton } from "../components/NeonButton";
import { ParticleBurst } from "../components/ParticleBurst";
import { ApexFairBadge } from "./ProvablyFairBadge";
import { useApexGame } from "./useApexGame";

export default function MinesGame() {
  const [bet, setBet] = useState(100);
  const [mines, setMines] = useState(3);
  const [grid, setGrid] = useState<Array<"hidden" | "gem" | "bomb">>(Array(25).fill("hidden"));
  const [revealedBombs, setRevealedBombs] = useState<number[]>([]);
  const [burst, setBurst] = useState(0);
  const { play, loading, last } = useApexGame();

  async function deal() {
    const res = await play("mines", { phon: bet }, { mines, picks: 5 });
    if (!res?.ok) return;
    const next: Array<"hidden" | "gem" | "bomb"> = Array(25).fill("hidden");
    const bombs: number[] = res.result?.bombs ?? [];
    const picks: number[] = res.result?.picks ?? [];
    picks.forEach((i) => (next[i] = bombs.includes(i) ? "bomb" : "gem"));
    setGrid(next);
    setRevealedBombs(bombs);
    if (Number(res.payout_phon) > bet) setBurst((x) => x + 1);
  }

  return (
    <div className="space-y-5">
      <ParticleBurst trigger={burst} />
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black apex-gradient-text flex items-center gap-2">
          <Bomb className="w-7 h-7 text-primary" /> MINES
        </h1>
        <ApexFairBadge hash={last?.server_seed_hash} seed={last?.client_seed} nonce={last?.nonce} />
      </div>

      <GlowCard>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-5 gap-2">
            {grid.map((c, i) => (
              <div
                key={i}
                className={`aspect-square rounded-lg border flex items-center justify-center text-lg transition ${
                  c === "gem" ? "border-primary bg-primary/15 apex-text-neon apex-pulse"
                  : c === "bomb" ? "border-destructive bg-destructive/20 text-destructive"
                  : revealedBombs.includes(i) ? "border-destructive/40 bg-destructive/5 text-destructive/60"
                  : "border-border bg-background/40 text-muted-foreground"
                }`}
              >
                {c === "gem" ? <Gem className="w-5 h-5" /> : c === "bomb" || revealedBombs.includes(i) ? "💣" : "?"}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">Bet (PHON)</label>
              <input type="number" min={10} value={bet}
                onChange={(e) => setBet(Math.max(10, Number(e.target.value) || 10))}
                className="mt-1 w-full rounded-lg bg-input border border-border px-3 py-2 text-sm font-bold" />
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">Mines ({mines})</label>
              <input type="range" min={1} max={20} value={mines}
                onChange={(e) => setMines(Number(e.target.value))}
                className="mt-3 w-full accent-accent" />
            </div>
          </div>

          <NeonButton size="xl" pulse className="w-full" onClick={deal} disabled={loading}>
            {loading ? "DEALING…" : `DEAL · ${bet.toLocaleString()} PHON`}
          </NeonButton>
          <p className="text-center text-[10px] text-muted-foreground">5×5 · auto 5 picks · House Edge 1.0%</p>
        </div>
      </GlowCard>
    </div>
  );
}
