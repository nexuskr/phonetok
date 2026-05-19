import { useEffect, useRef, useState } from "react";
import { Rocket } from "lucide-react";
import { GlowCard } from "../components/GlowCard";
import { NeonButton } from "../components/NeonButton";
import { ParticleBurst } from "../components/ParticleBurst";
import { ApexFairBadge } from "./ProvablyFairBadge";
import { useApexGame } from "./useApexGame";

export default function CrashGame() {
  const [bet, setBet] = useState(100);
  const [autoCashout, setAutoCashout] = useState(2);
  const [phase, setPhase] = useState<"idle" | "flying" | "crashed">("idle");
  const [mult, setMult] = useState(1);
  const [target, setTarget] = useState<number | null>(null);
  const [burst, setBurst] = useState(0);
  const { play, loading, last } = useApexGame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (phase !== "flying" || !target) return;
    startRef.current = performance.now();
    const tick = (t: number) => {
      const dt = (t - startRef.current) / 1000;
      const m = +Math.pow(1.06, dt * 8).toFixed(2);
      if (m >= target) {
        setMult(target);
        const won = autoCashout <= target;
        setPhase("crashed");
        if (won) setBurst((b) => b + 1);
        return;
      }
      setMult(m);
      // draw
      const c = canvasRef.current;
      if (c) {
        const ctx = c.getContext("2d")!;
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.strokeStyle = won() ? "#FF00FF" : "#00FF9F";
        ctx.lineWidth = 3;
        ctx.shadowColor = ctx.strokeStyle as string;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(0, c.height);
        for (let x = 0; x <= c.width; x += 4) {
          const px = x / c.width;
          const y = c.height - Math.pow(1.06, px * dt * 8) * 8;
          ctx.lineTo(x, Math.max(8, y));
        }
        ctx.stroke();
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    function won() { return autoCashout <= mult; }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, target, autoCashout]);

  async function start() {
    setPhase("idle");
    setMult(1);
    const res = await play("crash", { phon: bet }, { auto_cashout: autoCashout });
    if (!res?.ok) return;
    const crashAt = Number(res.result?.crash_at ?? 1);
    setTarget(crashAt);
    setPhase("flying");
  }

  const won = last?.result && Number(last.payout_phon) > bet;

  return (
    <div className="space-y-5">
      <ParticleBurst trigger={burst} />
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black apex-gradient-text flex items-center gap-2">
          <Rocket className="w-7 h-7 text-primary" /> CRASH
        </h1>
        <ApexFairBadge hash={last?.server_seed_hash} seed={last?.client_seed} nonce={last?.nonce} />
      </div>

      <GlowCard>
        <div className="p-6 space-y-4">
          <div className="relative h-56 rounded-xl bg-background/70 overflow-hidden border border-primary/20">
            <canvas ref={canvasRef} width={600} height={224} className="absolute inset-0 w-full h-full" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className={`text-7xl font-black tabular-nums ${phase === "crashed" && (last?.multiplier ?? 0) < autoCashout ? "text-destructive" : "apex-text-neon"}`}>
                {mult.toFixed(2)}x
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">Bet (PHON)</label>
              <input type="number" min={10} value={bet}
                onChange={(e) => setBet(Math.max(10, Number(e.target.value) || 10))}
                disabled={phase === "flying"}
                className="mt-1 w-full rounded-lg bg-input border border-border px-3 py-2 text-sm font-bold" />
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">Auto Cashout</label>
              <input type="number" min={1.01} step={0.01} value={autoCashout}
                onChange={(e) => setAutoCashout(Math.max(1.01, Number(e.target.value) || 1.01))}
                disabled={phase === "flying"}
                className="mt-1 w-full rounded-lg bg-input border border-border px-3 py-2 text-sm font-bold apex-text-magenta" />
            </div>
          </div>

          <NeonButton size="xl" pulse className="w-full" onClick={start} disabled={loading || phase === "flying"}>
            {phase === "flying" ? `FLYING @ ${autoCashout}x` : `LAUNCH · ${bet.toLocaleString()} PHON`}
          </NeonButton>
          {phase === "crashed" && (
            <div className={`text-center text-sm font-bold ${won ? "apex-text-neon" : "text-destructive"}`}>
              {won ? `CASHED OUT @ ${autoCashout}x` : `CRASHED @ ${last?.multiplier?.toFixed(2)}x`}
            </div>
          )}
          <p className="text-center text-[10px] text-muted-foreground">House Edge 1.0% · RTP 99.0%</p>
        </div>
      </GlowCard>
    </div>
  );
}
