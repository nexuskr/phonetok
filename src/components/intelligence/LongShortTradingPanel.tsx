import { useMemo, useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Zap } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SYMBOLS } from "@/lib/paper-trading/types";
import { usePaperStore } from "@/lib/paper-trading/store";
import { computeSize, liquidationPrice } from "@/lib/paper-trading/engine";
import { notify } from "@/lib/notify";
import { track } from "@/lib/telemetry";
import LivePriceChart from "./LivePriceChart";
import CountUp from "./CountUp";
import { useBybitTicker, type FeedStatus } from "@/hooks/use-bybit-ticker";

export interface PrefilledOrder {
  symbol?: string;
  side?: "long" | "short";
  leverage?: number;
}

const STATUS_LABEL: Record<FeedStatus, string> = {
  connecting: "연결 중…",
  open: "Live",
  reconnecting: "Reconnecting…",
  "rest-fallback": "REST 폴백",
};

export default function LongShortTradingPanel({ prefilled }: { prefilled?: PrefilledOrder }) {
  const { prices, status } = useBybitTicker();
  const [symbol, setSymbol] = useState<string>(prefilled?.symbol ?? "BTCUSDT");
  const [leverage, setLeverage] = useState<number>(prefilled?.leverage ?? 10);
  const [margin, setMargin] = useState<string>("100");
  const credit = usePaperStore((s) => s.paperCredit);
  const open = usePaperStore((s) => s.open);

  useEffect(() => { if (prefilled?.symbol) setSymbol(prefilled.symbol); }, [prefilled?.symbol]);
  useEffect(() => { if (prefilled?.leverage) setLeverage(prefilled.leverage); }, [prefilled?.leverage]);

  const price = prices[symbol] ?? 0;
  const marginNum = Math.max(0, parseFloat(margin) || 0);
  const setMarginPct = (pct: number) => {
    const v = Math.max(0, Math.floor(credit * pct * 100) / 100);
    setMargin(v.toString());
  };
  const size = useMemo(() => computeSize(marginNum, leverage, price), [marginNum, leverage, price]);
  const liqLong = useMemo(() => liquidationPrice("long", price, leverage), [price, leverage]);
  const liqShort = useMemo(() => liquidationPrice("short", price, leverage), [price, leverage]);

  const submit = (side: "long" | "short") => {
    if (!price) return notify.error("가격을 불러오는 중입니다.");
    if (marginNum <= 0) return notify.error("Trading Credit 금액을 입력하세요.");
    if (marginNum > credit) return notify.error("Trading Credit이 부족합니다 (Paper).");
    const pos = open({ symbol, side, leverage, margin: marginNum, entry: price });
    if (!pos) return notify.error("주문을 열 수 없습니다.");
    notify.success(`${side === "long" ? "Long" : "Short"} 진입`, {
      description: `${symbol} ${leverage}x · 마진 ${marginNum} USDT`,
    });
    track("cta_click", {
      surface: "paper_trade",
      variant: side,
      meta: { symbol, side, leverage, margin: marginNum, entry: price },
    });
  };

  // Keyboard shortcuts: L = long, S = short, ESC = clear margin focus
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "l" || e.key === "L") { e.preventDefault(); submit("long"); }
      else if (e.key === "s" || e.key === "S") { e.preventDefault(); submit("short"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, leverage, marginNum, price, credit]);

  return (
    <section className="glass-strong rounded-3xl border border-primary/30 p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          <h2 className="font-display font-bold text-lg">Trading Console</h2>
        </div>
        <div className="flex items-center gap-2 text-[10px] tracking-widest font-bold">
          <span className={`w-1.5 h-1.5 rounded-full ${status === "open" ? "bg-primary animate-pulse" : "bg-muted-foreground"}`} />
          <span className="text-muted-foreground">BYBIT · {STATUS_LABEL[status]}</span>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Select value={symbol} onValueChange={setSymbol}>
          <SelectTrigger className="bg-background/60"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SYMBOLS.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="px-3 py-2 rounded-md border border-border/60 bg-background/60 flex items-center justify-between text-sm">
          <span className="text-muted-foreground text-xs">Last</span>
          <span className="font-mono tabular-nums font-bold">
            {price ? price.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "—"}
          </span>
        </div>
        <div className="px-3 py-2 rounded-md border border-primary/30 bg-primary/5 flex items-center justify-between text-sm">
          <span className="text-primary text-xs">Trading Credit (Paper)</span>
          <CountUp value={credit} decimals={2} duration={600} className="font-mono tabular-nums font-bold text-primary" />
        </div>
      </div>

      <LivePriceChart symbol={symbol} prices={prices} height={260} />

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <div className="flex items-baseline justify-between">
            <label className="text-xs text-muted-foreground">마진 (USDT, Paper)</label>
            <div className="flex gap-1">
              {[0.25, 0.5, 0.75, 1].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setMarginPct(p)}
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-border/50 bg-background/60 hover:border-primary/50 hover:text-primary transition press"
                >
                  {p === 1 ? "MAX" : `${p * 100}%`}
                </button>
              ))}
            </div>
          </div>
          <Input
            type="number" inputMode="decimal" min={0}
            value={margin} onChange={(e) => setMargin(e.target.value)}
            className="mt-1 bg-background/60"
          />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <label className="text-xs text-muted-foreground">레버리지</label>
            <span className="text-sm font-bold text-primary tabular-nums">{leverage}×</span>
          </div>
          <Slider min={1} max={100} step={1} value={[leverage]} onValueChange={([v]) => setLeverage(v)} className="mt-3" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-xl bg-background/40 border border-border/40 p-3">
          <div className="text-muted-foreground">포지션 크기</div>
          <div className="font-mono tabular-nums font-bold mt-1">{size.toFixed(4)}</div>
        </div>
        <div className="rounded-xl bg-background/40 border border-border/40 p-3">
          <div className="text-muted-foreground">Long 청산가</div>
          <div className="font-mono tabular-nums font-bold mt-1 text-destructive">{liqLong.toFixed(2)}</div>
        </div>
        <div className="rounded-xl bg-background/40 border border-border/40 p-3">
          <div className="text-muted-foreground">Short 청산가</div>
          <div className="font-mono tabular-nums font-bold mt-1 text-destructive">{liqShort.toFixed(2)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          onClick={() => submit("long")}
          className="h-16 text-lg font-display font-black bg-emerald-500 hover:bg-emerald-500/90 text-emerald-50 shadow-lg shadow-emerald-500/20"
        >
          <TrendingUp className="w-5 h-5 mr-2" /> LONG
        </Button>
        <Button
          onClick={() => submit("short")}
          className="h-16 text-lg font-display font-black bg-rose-500 hover:bg-rose-500/90 text-rose-50 shadow-lg shadow-rose-500/20"
        >
          <TrendingDown className="w-5 h-5 mr-2" /> SHORT
        </Button>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[10px] text-muted-foreground/80 leading-relaxed">
          ⚠️ Paper Trading은 학습용 시뮬레이션입니다. 실제 잔액에 영향을 주지 않습니다.
        </p>
        <p className="text-[10px] text-muted-foreground/70 hidden sm:block">
          단축키: <kbd className="px-1 rounded bg-background/60 border border-border/50">L</kbd> Long ·{" "}
          <kbd className="px-1 rounded bg-background/60 border border-border/50">S</kbd> Short
        </p>
      </div>
    </section>
  );
}
