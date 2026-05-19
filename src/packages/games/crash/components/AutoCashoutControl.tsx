/**
 * AutoCashoutControl — gold-styled numeric stepper for the auto-cashout
 * target multiplier. Pure presentation; the parent owns the value.
 */
import { Minus, Plus, Zap } from "lucide-react";

interface Props {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}

const PRESETS = [1.5, 2, 5, 10];

export default function AutoCashoutControl({ value, onChange, disabled }: Props) {
  const v = parseFloat(value || "0");
  const step = (delta: number) => {
    const next = Math.max(1.01, Math.round((v + delta) * 100) / 100);
    onChange(next.toFixed(2));
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Zap className="w-3 h-3 text-[hsl(var(--gold))]" /> 자동 캐시아웃
        </span>
        <span className="text-[11px] text-[hsl(var(--gold))] font-bold tabular-nums">
          {v >= 1.01 ? `${v.toFixed(2)}x` : "off"}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => step(-0.1)}
          disabled={disabled}
          className="h-11 w-11 rounded-xl border border-border/50 bg-background/40 text-foreground flex items-center justify-center active:scale-95 disabled:opacity-50"
          aria-label="감소"
        >
          <Minus className="w-4 h-4" />
        </button>
        <input
          type="number"
          step="0.01"
          min="1.01"
          inputMode="decimal"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 h-11 rounded-xl border border-[hsl(var(--gold))]/30 bg-background/60 px-3 text-center text-base font-black tabular-nums text-[hsl(var(--gold))] disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => step(0.1)}
          disabled={disabled}
          className="h-11 w-11 rounded-xl border border-border/50 bg-background/40 text-foreground flex items-center justify-center active:scale-95 disabled:opacity-50"
          aria-label="증가"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            disabled={disabled}
            onClick={() => onChange(p.toFixed(2))}
            className={`h-8 rounded-lg text-[11px] font-bold border transition active:scale-95 disabled:opacity-50 ${
              Math.abs(v - p) < 0.001
                ? "bg-[hsl(var(--gold))]/20 border-[hsl(var(--gold))]/50 text-[hsl(var(--gold))]"
                : "bg-background/40 border-border/40 text-muted-foreground"
            }`}
          >
            {p}x
          </button>
        ))}
      </div>
    </div>
  );
}
