import { TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LightweightChartPanel from "./LightweightChartPanel";
import { ARENA_SYMBOLS } from "@/lib/trading/types";
import type { TickerStat } from "@/lib/paper-trading/bybit-feed";

interface OverlayLine { price: number; color: string; title: string }

interface Props {
  symbol: string;
  setSymbol: (s: string) => void;
  price: number;
  stat?: TickerStat;
  overlays?: OverlayLine[];
  height?: number;
}

const fmtPx = (p: number) => p ? p.toLocaleString(undefined, { maximumFractionDigits: 6 }) : "—";
const fmtVol = (n: number) => {
  if (!n) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toFixed(2);
};

export default function ChartWithHeader({ symbol, setSymbol, price, stat, overlays = [], height = 360 }: Props) {
  const change = stat?.change24hPct ?? 0;
  const up = change >= 0;
  return (
    <section className="glass-strong rounded-3xl border border-amber-400/20 p-3 sm:p-4 space-y-3 shadow-[0_0_60px_rgba(244,180,55,0.08)]">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <Select value={symbol} onValueChange={setSymbol}>
            <SelectTrigger className="w-44 h-10 bg-background/60 border-amber-400/30 font-display font-black tracking-wide">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {ARENA_SYMBOLS.map((s) => (
                <SelectItem key={s} value={s}>{s.replace("USDT", "")} / USDT</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-col">
            <span className={`font-mono tabular-nums font-black text-xl sm:text-2xl ${up ? "text-emerald-300" : "text-rose-300"}`}>
              {fmtPx(price)}
            </span>
            <span className={`text-[11px] font-bold inline-flex items-center gap-1 ${up ? "text-emerald-400" : "text-rose-400"}`}>
              {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {up ? "+" : ""}{change.toFixed(2)}% 24h
            </span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-[10px] sm:text-xs">
          <Cell label="24h High" v={fmtPx(stat?.high24h ?? 0)} tone="up" />
          <Cell label="24h Low" v={fmtPx(stat?.low24h ?? 0)} tone="down" />
          <Cell label="Turnover" v={`$${fmtVol(stat?.turnover24h ?? 0)}`} tone="muted" />
        </div>
      </div>

      <div className="rounded-2xl border border-border/40 bg-background/40 p-2">
        <LightweightChartPanel symbol={symbol} price={price} overlays={overlays} height={height} />
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground/80 px-1">
        <span className="inline-flex items-center gap-1">
          <BarChart3 className="w-3 h-3" /> 1m candles · live · client-built
        </span>
        <span>Vol 24h <span className="font-mono tabular-nums text-foreground">{fmtVol(stat?.volume24h ?? 0)}</span></span>
      </div>
    </section>
  );
}

function Cell({ label, v, tone }: { label: string; v: string; tone?: "up" | "down" | "muted" }) {
  const cls = tone === "up" ? "text-emerald-300" : tone === "down" ? "text-rose-300" : "text-foreground";
  return (
    <div className="rounded-lg bg-background/40 border border-border/40 px-2 py-1.5 min-w-[88px]">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-mono tabular-nums font-bold ${cls}`}>{v}</div>
    </div>
  );
}
