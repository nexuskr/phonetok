/**
 * ImperialBetPanel — luxury bet panel.
 * Presentation only — all money RPCs are passed in by the parent so this
 * panel remains money-flow-neutral and reusable.
 */
import { CheckCircle2, Loader2, Rocket } from "lucide-react";
import { motion } from "framer-motion";
import AutoCashoutControl from "./AutoCashoutControl";

export type BetUiState = "idle" | "submitting" | "placed" | "cashing" | "paid" | "lost";

interface Props {
  bet: number;
  setBet: (n: number) => void;
  autoCashout: string;
  setAutoCashout: (s: string) => void;
  betState: BetUiState;
  phase: "idle" | "pending" | "running" | "crashed";
  multiplier: number;
  onPlace: () => void;
  onCashout: () => void;
}

const QUICK = [10000, 50000, 100000, 500000];

export default function ImperialBetPanel({
  bet, setBet, autoCashout, setAutoCashout,
  betState, phase, multiplier, onPlace, onCashout,
}: Props) {
  const locked = betState !== "idle";
  return (
    <div className="rounded-2xl border border-[hsl(var(--gold))]/30 bg-gradient-to-br from-card to-card/60 p-4 space-y-4 shadow-[0_0_30px_hsla(45,80%,40%,0.08)]">
      <div className="grid grid-cols-4 gap-2">
        {QUICK.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setBet(q)}
            disabled={locked}
            className={`h-11 rounded-xl font-bold text-sm border transition active:scale-95 disabled:opacity-50 ${
              bet === q
                ? "bg-gradient-to-br from-[hsl(var(--gold))]/30 to-[hsl(var(--pink))]/20 border-[hsl(var(--gold))]/60 text-[hsl(var(--gold))]"
                : "bg-background/40 border-border/40 text-foreground"
            }`}
          >
            {q >= 1000 ? `${q / 1000}k` : q}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-[11px] text-muted-foreground">베팅 (PHON)</span>
          <input
            type="number"
            inputMode="numeric"
            value={bet}
            disabled={locked}
            onChange={(e) => setBet(Math.max(100, Number(e.target.value || 0)))}
            className="w-full h-12 rounded-xl border border-border/50 bg-background/60 px-3 text-base font-bold text-foreground tabular-nums disabled:opacity-60"
          />
        </label>
        <AutoCashoutControl value={autoCashout} onChange={setAutoCashout} disabled={locked} />
      </div>

      <PrimaryButton
        betState={betState}
        phase={phase}
        multiplier={multiplier}
        bet={bet}
        onPlace={onPlace}
        onCashout={onCashout}
      />
    </div>
  );
}

function PrimaryButton({
  betState, phase, multiplier, bet, onPlace, onCashout,
}: Pick<Props, "betState" | "phase" | "multiplier" | "bet" | "onPlace" | "onCashout">) {
  if (betState === "placed" && phase === "running") {
    return (
      <motion.button
        type="button"
        onClick={onCashout}
        animate={{ scale: [1, 1.02, 1] }}
        transition={{ duration: 1.1, repeat: Infinity }}
        className="w-full h-14 rounded-xl bg-gradient-to-r from-[hsl(var(--gold))] to-[hsl(var(--pink))] text-background font-black text-lg shadow-[0_0_30px_hsla(45,90%,55%,0.5)] active:scale-[0.98]"
      >
        💰 캐시아웃 {multiplier.toFixed(2)}x · +{Math.floor(bet * multiplier).toLocaleString()}
      </motion.button>
    );
  }
  if (betState === "cashing" || betState === "submitting") {
    const label = betState === "cashing" ? "정산 중…" : "베팅 중…";
    return (
      <button disabled className="w-full h-14 rounded-xl bg-[hsl(var(--gold))]/70 text-background font-black text-lg flex items-center justify-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> {label}
      </button>
    );
  }
  if (betState === "placed" && phase !== "running") {
    return (
      <button disabled className="w-full h-14 rounded-xl bg-card border border-[hsl(var(--gold))]/50 text-[hsl(var(--gold))] font-black text-base flex items-center justify-center gap-2">
        <CheckCircle2 className="w-5 h-5" /> 베팅 완료 · 라운드 시작 대기
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onPlace}
      disabled={phase !== "pending"}
      className="w-full h-14 rounded-xl bg-gradient-to-r from-[hsl(var(--gold))] to-[hsl(var(--gold))]/80 text-background font-black text-lg active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
    >
      <Rocket className="w-5 h-5" />
      {phase === "pending" ? `${bet.toLocaleString()} PHON 베팅` : "라운드 대기 중…"}
    </button>
  );
}
