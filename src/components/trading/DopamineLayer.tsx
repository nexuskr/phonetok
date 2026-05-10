import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { sfx } from "@/lib/trading/sounds";

type FxKind = "win" | "legendary" | "liquidate" | "loss" | null;
interface Fx { kind: FxKind; pnl: number; roi: number; symbol?: string }

let pushExternal: ((fx: Fx) => void) | null = null;
export function triggerFx(fx: Fx) { pushExternal?.(fx); }

export default function DopamineLayer() {
  const [fx, setFx] = useState<Fx | null>(null);

  useEffect(() => { pushExternal = (f) => setFx(f); return () => { pushExternal = null; }; }, []);

  useEffect(() => {
    if (!fx?.kind) return;
    if (fx.kind === "win" || fx.kind === "legendary") {
      const big = fx.kind === "legendary";
      confetti({ particleCount: big ? 240 : 120, spread: 100, origin: { y: 0.4 }, scalar: big ? 1.4 : 1, colors: ["#f4b437","#fde68a","#a7f3d0","#34d399","#fbbf24"] });
      if (big) {
        setTimeout(() => confetti({ particleCount: 200, angle: 60, spread: 70, origin: { x: 0, y: 0.5 } }), 200);
        setTimeout(() => confetti({ particleCount: 200, angle: 120, spread: 70, origin: { x: 1, y: 0.5 } }), 400);
        sfx.legendary();
      } else { sfx.win(); }
    } else if (fx.kind === "liquidate") {
      sfx.liquidate();
      document.body.animate(
        [{ transform: "translate(0,0)" }, { transform: "translate(-8px,4px)" }, { transform: "translate(8px,-4px)" }, { transform: "translate(-4px,2px)" }, { transform: "translate(0,0)" }],
        { duration: 500, iterations: 1 }
      );
    } else if (fx.kind === "loss") {
      sfx.loss();
    }
    const t = setTimeout(() => setFx(null), fx.kind === "legendary" ? 3500 : fx.kind === "win" ? 2200 : 2400);
    return () => clearTimeout(t);
  }, [fx]);

  if (!fx?.kind) return null;

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none flex items-center justify-center">
      {fx.kind === "liquidate" && (
        <div className="absolute inset-0 bg-gradient-radial from-red-600/40 via-red-900/30 to-black/0 animate-[fade_0.6s_ease-out]" />
      )}
      <div className={`relative px-8 py-6 rounded-3xl backdrop-blur-md border-2 ${
        fx.kind === "legendary" ? "border-amber-300/80 bg-amber-500/10 shadow-[0_0_120px_rgba(244,180,55,0.6)]"
        : fx.kind === "win" ? "border-emerald-400/60 bg-emerald-500/10 shadow-[0_0_80px_rgba(52,211,153,0.5)]"
        : fx.kind === "liquidate" ? "border-red-500/80 bg-red-900/30 shadow-[0_0_120px_rgba(220,38,38,0.7)]"
        : "border-rose-400/60 bg-rose-500/10"
      }`}>
        <div className="text-center">
          <div className={`font-black tracking-[0.2em] text-xs sm:text-sm mb-1 ${
            fx.kind === "legendary" ? "text-amber-200" :
            fx.kind === "win" ? "text-emerald-200" :
            fx.kind === "liquidate" ? "text-red-200" : "text-rose-200"
          }`}>
            {fx.kind === "legendary" ? "🔥 LEGENDARY WIN 🔥"
              : fx.kind === "win" ? "✨ WIN ✨"
              : fx.kind === "liquidate" ? "💥 LIQUIDATED 💥"
              : "LOSS"}
          </div>
          <div className={`font-display font-black text-3xl sm:text-5xl tabular-nums ${
            fx.kind === "legendary" ? "text-amber-100"
              : fx.kind === "win" ? "text-emerald-100"
              : "text-red-100"
          }`}>
            {fx.pnl >= 0 ? "+" : ""}{fx.pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })} USDT
          </div>
          <div className="mt-1 text-xs font-mono tabular-nums opacity-80">
            ROI {(fx.roi * 100).toFixed(1)}% {fx.symbol ? `· ${fx.symbol}` : ""}
          </div>
        </div>
      </div>
    </div>
  );
}
