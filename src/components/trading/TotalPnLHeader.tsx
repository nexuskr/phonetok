import { memo, useEffect, useMemo, useRef, useState } from "react";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import type { LivePosition } from "@/lib/trading/types";
import { computePnl } from "@/lib/trading/engine";
import { KRW_PER_USDT, type Unit } from "@/lib/trading/currency";

interface Props {
  positions: LivePosition[];
  prices: Record<string, number>;
  unit: Unit;
}

/**
 * Real-time Total Unrealized PnL header — USDT + KRW dual display.
 * Smart shake: gentle pulse always; strong shake only when |Δpct| ≥ 0.5%.
 * Hybrid Net View: per-symbol netted size + PnL chips (long − short).
 */
function TotalPnLHeaderImpl({ positions, prices, unit }: Props) {
  const { pnlUSDT, totalMargin, hasCross, equityUSDT, mmrPct, netBySymbol } = useMemo(() => {
    let pnl = 0;
    let mg = 0;
    let crossInitial = 0;
    let crossUnrealized = 0;
    let cross = false;
    const net = new Map<string, { netSize: number; pnl: number; longs: number; shorts: number }>();
    for (const p of positions) {
      const mark = prices[p.symbol] ?? p.entry;
      const ppnl = computePnl(p.side, p.entry, mark, p.size);
      pnl += ppnl;
      mg += p.margin;
      if (p.margin_mode === "cross") {
        cross = true;
        crossInitial += p.margin;
        crossUnrealized += ppnl;
      }
      const cur = net.get(p.symbol) ?? { netSize: 0, pnl: 0, longs: 0, shorts: 0 };
      cur.netSize += p.side === "long" ? p.size : -p.size;
      cur.pnl += ppnl;
      if (p.side === "long") cur.longs += 1; else cur.shorts += 1;
      net.set(p.symbol, cur);
    }
    const pnlU = unit === "KRW" ? pnl / KRW_PER_USDT : pnl;
    const crossInitialU = unit === "KRW" ? crossInitial / KRW_PER_USDT : crossInitial;
    const crossUnrealU = unit === "KRW" ? crossUnrealized / KRW_PER_USDT : crossUnrealized;
    const eq = crossInitialU + crossUnrealU;
    const mmr = crossInitialU > 0 ? (eq / crossInitialU) * 100 : 0;
    const netArr = Array.from(net.entries())
      .map(([symbol, v]) => ({ symbol, ...v }))
      .filter((r) => r.longs + r.shorts >= 2 || (r.longs >= 1 && r.shorts >= 1))
      .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
      .slice(0, 6);
    return { pnlUSDT: pnlU, totalMargin: mg, hasCross: cross, equityUSDT: eq, mmrPct: mmr, netBySymbol: netArr };
  }, [positions, prices, unit]);

  const pnlKRW = pnlUSDT * KRW_PER_USDT;
  const pct = totalMargin > 0 ? (pnlUSDT / (unit === "KRW" ? totalMargin / KRW_PER_USDT : totalMargin)) * 100 : 0;
  const positive = pnlUSDT >= 0;
  const has = positions.length > 0;

  // Smart shake — fires only on big moves (≥0.5% delta), once per change.
  const prevPctRef = useRef(pct);
  const [shakeKey, setShakeKey] = useState(0);
  useEffect(() => {
    const delta = Math.abs(pct - prevPctRef.current);
    if (delta >= 0.5) setShakeKey((k) => k + 1);
    prevPctRef.current = pct;
  }, [pct]);

  return (
    <section
      className={`relative overflow-hidden rounded-3xl border p-4 sm:p-5 transition ${
        !has
          ? "border-border/40 bg-background/40"
          : positive
            ? "border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 via-background/40 to-background/40 shadow-[0_0_60px_rgba(52,211,153,0.18)]"
            : "border-rose-500/40 bg-gradient-to-br from-rose-500/10 via-background/40 to-background/40 shadow-[0_0_60px_rgba(244,63,94,0.18)]"
      }`}
      aria-label="Total unrealized PnL"
    >
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Activity className={`w-4 h-4 ${positive ? "text-emerald-300" : "text-rose-300"}`} />
          <span className="text-[11px] uppercase tracking-[0.18em] font-black text-muted-foreground">
            Unrealized PnL
          </span>
          {has && (
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-background/60 border border-border/50">
              {positions.length} open
            </span>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground/80">실시간 · ≈ ₩{KRW_PER_USDT.toLocaleString()}/USDT</div>
      </div>

      <div className="mt-2 flex items-end flex-wrap gap-x-6 gap-y-1">
        <div
          key={shakeKey}
          className={`font-display font-black text-3xl sm:text-4xl tabular-nums tracking-tight will-change-transform animate-strong-shake ${
            positive ? "text-emerald-300" : "text-rose-300"
          }`}
        >
          <span className="inline-block animate-gentle-pulse">
            {positive ? "+" : ""}{pnlUSDT.toFixed(2)} <span className="text-base font-bold opacity-70">USDT</span>
          </span>
        </div>
        <div className={`text-base sm:text-lg font-mono tabular-nums font-black ${positive ? "text-emerald-400" : "text-rose-400"}`}>
          ≈ {pnlKRW < 0 ? "-" : positive && pnlKRW > 0 ? "+" : ""}₩{Math.abs(Math.floor(pnlKRW)).toLocaleString()}
        </div>
        {has && (
          <div className={`inline-flex items-center gap-1 text-sm font-black ${positive ? "text-emerald-400" : "text-rose-400"}`}>
            {positive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {positive ? "+" : ""}{pct.toFixed(2)}%
          </div>
        )}
      </div>

      {/* Hybrid Net View — per-symbol netting (only shows symbols with multiple/opposing positions) */}
      {netBySymbol.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/40">
          <div className="text-[10px] uppercase tracking-[0.18em] font-black text-muted-foreground/80 mb-2">
            Hybrid Net · 심볼별 순포지션
          </div>
          <div className="flex flex-wrap gap-1.5">
            {netBySymbol.map((r) => {
              const dir = r.netSize > 0 ? "L" : r.netSize < 0 ? "S" : "—";
              const dirClass =
                r.netSize > 0
                  ? "text-emerald-300 border-emerald-500/40"
                  : r.netSize < 0
                    ? "text-rose-300 border-rose-500/40"
                    : "text-muted-foreground border-border/50";
              const pnlClass = r.pnl >= 0 ? "text-emerald-400" : "text-rose-400";
              return (
                <div
                  key={r.symbol}
                  className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 bg-background/60 ${dirClass}`}
                  title={`${r.symbol} · ${r.longs}L / ${r.shorts}S`}
                >
                  <span className="text-[10px] font-black tracking-wider">{r.symbol.replace("USDT", "")}</span>
                  <span className="text-[9px] opacity-80 font-mono tabular-nums">
                    {dir} {Math.abs(r.netSize).toFixed(3)}
                  </span>
                  <span className={`text-[10px] font-black tabular-nums ${pnlClass}`}>
                    {r.pnl >= 0 ? "+" : ""}{r.pnl.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {hasCross && (
        <div className="mt-2 flex items-center justify-end gap-3 text-[11px] font-mono tabular-nums text-muted-foreground border-t border-border/40 pt-2">
          <span>
            <span className="opacity-70 mr-1">Equity</span>
            <span className="text-foreground font-bold">{equityUSDT.toFixed(2)} {unit}</span>
          </span>
          <span className="opacity-40">·</span>
          <span>
            <span className="opacity-70 mr-1">Maint. Margin</span>
            <span className={`font-bold ${mmrPct < 50 ? "text-rose-400" : mmrPct < 100 ? "text-amber-300" : "text-emerald-300"}`}>
              {mmrPct.toFixed(1)}%
            </span>
          </span>
        </div>
      )}
    </section>
  );
}

export default memo(TotalPnLHeaderImpl);
