/**
 * ImperialTradeSection — v19 Ultimate Stake Crusher
 * 큰 가격 + sparkline + LONG/SHORT 진입 카드. 머니플로 0, RPC 0.
 * 가격 소스: 기존 useBybitTicker 1회 사용.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown, ChevronRight } from "lucide-react";
import { useBybitTicker } from "@/hooks/use-bybit-ticker";

const SYMBOLS = [
  { id: "BTCUSDT", label: "BTC" },
  { id: "ETHUSDT", label: "ETH" },
  { id: "SOLUSDT", label: "SOL" },
] as const;

type SymId = (typeof SYMBOLS)[number]["id"];

function Spark({ data, up }: { data: number[]; up: boolean }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = Math.max(max - min, 0.0001);
  const w = 320;
  const h = 70;
  const stepX = w / (data.length - 1);
  const pts = data
    .map((v, i) => `${(i * stepX).toFixed(2)},${(h - ((v - min) / span) * h).toFixed(2)}`)
    .join(" ");
  const stroke = up ? "hsl(140 70% 55%)" : "hsl(355 80% 60%)";
  const fillStop = up ? "hsl(140 70% 55% / 0.35)" : "hsl(355 80% 60% / 0.35)";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={`sg-${up ? "u" : "d"}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillStop} />
          <stop offset="100%" stopColor="hsl(var(--background) / 0)" />
        </linearGradient>
      </defs>
      <polyline points={`0,${h} ${pts} ${w},${h}`} fill={`url(#sg-${up ? "u" : "d"})`} stroke="none" />
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default function ImperialTradeSection() {
  const { prices, stats } = useBybitTicker();
  const [sym, setSym] = useState<SymId>("BTCUSDT");
  const [series, setSeries] = useState<number[]>([]);
  const lastPushRef = useRef(0);

  // 가격이 들어올 때마다 sparkline 시리즈에 push (최대 40 포인트, 1.2s throttle)
  useEffect(() => {
    const p = prices[sym];
    if (!p) return;
    const now = Date.now();
    if (now - lastPushRef.current < 1200) return;
    lastPushRef.current = now;
    setSeries((prev) => [...prev.slice(-39), p]);
  }, [prices, sym]);

  // 심볼 바꿀 때 시리즈 리셋
  useEffect(() => { setSeries([]); lastPushRef.current = 0; }, [sym]);

  const price = prices[sym];
  const stat = stats[sym];
  const changePct = stat?.change24hPct ?? 0;
  const up = changePct >= 0;

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <h2 className="text-base sm:text-lg font-bold tracking-tight">트레이딩</h2>
        <Link to="/trade" className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5">
          차트 열기 <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="imperial-card-hover imperial-corner-shine rounded-2xl border border-[hsl(var(--gold)/0.4)] bg-gradient-to-br from-stone-950 via-background/95 to-stone-950 p-4 sm:p-5 relative overflow-hidden">
        {/* ambient */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-60"
          style={{
            background: up
              ? "radial-gradient(60% 80% at 80% 0%, hsl(140 70% 45% / 0.18), transparent 70%)"
              : "radial-gradient(60% 80% at 80% 0%, hsl(355 80% 50% / 0.18), transparent 70%)",
          }}
        />

        {/* Symbol tabs */}
        <div className="flex items-center gap-1.5 mb-3">
          {SYMBOLS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSym(s.id)}
              className={`px-3 py-1 rounded-full text-[11px] font-bold tracking-wide transition press ${
                sym === s.id
                  ? "bg-gradient-to-r from-[hsl(var(--gold))] to-[hsl(var(--pink))] text-background shadow-[0_0_14px_hsl(var(--gold)/0.55)]"
                  : "bg-card/40 text-muted-foreground border border-border/50 hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
          <div className="ml-auto text-[10px] tracking-[0.3em] text-[hsl(var(--gold))] font-black uppercase">
            Imperial Trade
          </div>
        </div>

        {/* Price + change */}
        <div className="flex items-baseline gap-3">
          <div className="font-mono font-black tabular-nums text-3xl sm:text-4xl text-foreground drop-shadow-[0_0_22px_hsl(var(--gold)/0.25)]">
            {price ? `$${price.toLocaleString(undefined, { maximumFractionDigits: price > 100 ? 2 : 4 })}` : "—"}
          </div>
          <div className={`text-sm font-bold ${up ? "text-emerald-400" : "text-rose-400"}`}>
            {up ? "▲" : "▼"} {Math.abs(changePct).toFixed(2)}%
            <span className="text-muted-foreground font-normal ml-1">24h</span>
          </div>
        </div>

        {/* Sparkline */}
        <div className="mt-2 mb-4">
          <Spark data={series.length >= 2 ? series : (price ? [price * 0.998, price, price * 1.001, price * 1.0005, price] : [])} up={up} />
        </div>

        {/* LONG / SHORT */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/trade?side=long"
            className="imperial-card-hover group relative overflow-hidden rounded-xl px-4 py-3.5 flex items-center justify-between border border-emerald-500/40 bg-gradient-to-br from-emerald-600/30 via-emerald-700/15 to-stone-950 hover:border-emerald-400/80 hover:shadow-[0_0_28px_hsl(140_70%_45%/0.55)] transition press"
          >
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-500/25 text-emerald-300 shadow-[inset_0_0_12px_hsl(140_70%_45%/0.5)]">
                <TrendingUp className="w-5 h-5" />
              </span>
              <div className="leading-tight">
                <div className="font-black text-base text-foreground">LONG</div>
                <div className="text-[10px] text-emerald-300/80 tracking-wider uppercase">상승 베팅</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-emerald-300 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          <Link
            to="/trade?side=short"
            className="imperial-card-hover group relative overflow-hidden rounded-xl px-4 py-3.5 flex items-center justify-between border border-rose-500/40 bg-gradient-to-br from-rose-600/30 via-rose-700/15 to-stone-950 hover:border-rose-400/80 hover:shadow-[0_0_28px_hsl(355_80%_50%/0.55)] transition press"
          >
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-rose-500/25 text-rose-300 shadow-[inset_0_0_12px_hsl(355_80%_50%/0.5)]">
                <TrendingDown className="w-5 h-5" />
              </span>
              <div className="leading-tight">
                <div className="font-black text-base text-foreground">SHORT</div>
                <div className="text-[10px] text-rose-300/80 tracking-wider uppercase">하락 베팅</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-rose-300 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        <div className="mt-3 text-[11px] text-muted-foreground">
          PHON 잔액으로 즉시 진입 · 평균 체결 0.8초
        </div>
      </div>
    </section>
  );
}
