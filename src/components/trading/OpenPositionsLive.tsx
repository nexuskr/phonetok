import { memo, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Activity, X, Heart, Target, ShieldCheck, TrendingUp as TUp } from "lucide-react";
import type { LivePosition } from "@/lib/trading/types";
import { computePnl, computeRoi, liquidationProgress } from "@/lib/trading/engine";
import { triggerFx } from "./DopamineLayer";
import { sfx } from "@/lib/trading/sounds";
import { useTriggerStore, type PositionTriggers } from "@/lib/trading/triggers-store";

interface CloseResult { pnl: number; roi: number; credit: number; exit: number }
interface CloseError { error: string }

interface Props {
  positions: LivePosition[];
  prices: Record<string, number>;
  busy?: boolean;
  onClose: (id: string, mark: number) => Promise<CloseResult | CloseError>;
  onLiquidate: (id: string, mark: number) => Promise<unknown>;
  onCloseAll: () => void;
  modeLabel: string;
  unit?: "USDT" | "KRW";
}

function fmtFn(unit: "USDT" | "KRW") {
  return (n: number) => unit === "KRW"
    ? `${n < 0 ? "-" : ""}₩${Math.abs(Math.floor(n)).toLocaleString()}`
    : n.toFixed(2);
}

function OpenPositionsLiveImpl({
  positions, prices, busy, onClose, onLiquidate, onCloseAll, modeLabel, unit = "USDT",
}: Props) {
  const fmt = fmtFn(unit);
  const liqLock = useRef<Set<string>>(new Set());

  // Auto-liquidate when ROI <= -0.99
  useEffect(() => {
    for (const p of positions) {
      const m = prices[p.symbol] ?? 0;
      if (!m) continue;
      const roi = computeRoi(p.side, p.entry, m, p.leverage);
      if (roi <= -0.99 && !liqLock.current.has(p.id)) {
        liqLock.current.add(p.id);
        onLiquidate(p.id, m).then(() => {
          triggerFx({ kind: "liquidate", pnl: -p.margin, roi: -1, symbol: p.symbol });
        }).catch(() => liqLock.current.delete(p.id));
      }
    }
  }, [positions, prices, onLiquidate]);

  const total = useMemo(() =>
    positions.reduce((s, p) => s + computePnl(p.side, p.entry, prices[p.symbol] ?? p.entry, p.size), 0),
  [positions, prices]);

  if (!positions.length) {
    return (
      <EmptyState
        icon={<Activity className="w-5 h-5" />}
        variant="muted"
        size="sm"
        title="열린 포지션 없음"
        description={`${modeLabel} 모드에서 LONG/SHORT으로 첫 트레이드를 시작하세요.`}
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="text-xs text-muted-foreground">
          {positions.length}개 · 미실현{" "}
          <span className={`font-mono font-bold ${total >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {total >= 0 ? "+" : ""}{fmt(total)}
          </span>
          <span className="ml-1 text-[10px] opacity-70">{unit}</span>
        </div>
        <Button size="sm" variant="outline" onClick={onCloseAll} className="h-7 text-xs">
          <X className="w-3 h-3 mr-1" /> Close All
        </Button>
      </div>

      {positions.map((p) => (
        <PositionRow
          key={p.id}
          position={p}
          mark={prices[p.symbol] ?? p.entry}
          busy={!!busy}
          unit={unit}
          onClose={onClose}
        />
      ))}
    </div>
  );
}

interface RowProps {
  position: LivePosition;
  mark: number;
  busy: boolean;
  unit: "USDT" | "KRW";
  onClose: (id: string, mark: number) => Promise<CloseResult | CloseError>;
}

function PositionRowImpl({ position: p, mark, busy, unit, onClose }: RowProps) {
  const fmt = fmtFn(unit);
  const pnl = computePnl(p.side, p.entry, mark, p.size);
  const roi = computeRoi(p.side, p.entry, mark, p.leverage);
  const liqPct = liquidationProgress(p.side, p.entry, mark, p.leverage);
  const nearMiss = roi <= -0.85 && roi > -0.99;
  const positive = pnl >= 0;

  return (
    <div
      className={`glass rounded-2xl border p-3 sm:p-4 space-y-2 transition ${
        nearMiss ? "border-red-500/70 shadow-[0_0_30px_rgba(239,68,68,0.4)] animate-pulse"
        : positive ? "border-emerald-500/40" : "border-border/50"
      }`}
    >
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-center">
        <div className="text-sm font-black">{p.symbol}</div>
        <div className={`text-xs font-black ${p.side === "long" ? "text-emerald-400" : "text-rose-400"}`}>
          {p.side.toUpperCase()} {p.leverage}×
        </div>
        <div className="text-xs text-muted-foreground">
          <span className="block">진입</span>
          <span className="font-mono tabular-nums text-foreground">{p.entry.toFixed(4)}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          <span className="block">현재</span>
          <span className="font-mono tabular-nums text-foreground">{mark.toFixed(4)}</span>
        </div>
        <div className={`text-sm font-mono tabular-nums font-bold ${positive ? "text-emerald-400" : "text-rose-400"}`}>
          {positive ? "+" : ""}{fmt(pnl)}
          <span className="block text-[10px]">{(roi * 100).toFixed(1)}%</span>
        </div>
        <Button
          size="sm" variant="outline" disabled={busy}
          onClick={async () => {
            sfx.click();
            const r = await onClose(p.id, mark);
            if ("error" in r) return;
            if (r.pnl > 0) {
              triggerFx({ kind: r.roi >= 5 ? "legendary" : "win", pnl: r.pnl, roi: r.roi, symbol: p.symbol });
            } else {
              triggerFx({ kind: "loss", pnl: r.pnl, roi: r.roi, symbol: p.symbol });
            }
          }}
        >
          청산
        </Button>
      </div>

      <div className="relative h-1.5 rounded-full bg-background/60 overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 transition-all ${
            liqPct >= 0.85 ? "bg-red-500" : liqPct >= 0.5 ? "bg-amber-400" : "bg-emerald-400"
          }`}
          style={{ width: `${Math.min(100, liqPct * 100)}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>Liq {p.liq_price.toFixed(4)}</span>
        {nearMiss && <span className="text-red-400 font-black flex items-center gap-1"><Heart className="w-3 h-3 animate-pulse" /> NEAR LIQUIDATION</span>}
        <span>{(liqPct * 100).toFixed(1)}% to liq</span>
      </div>
    </div>
  );
}

const PositionRow = memo(PositionRowImpl, (a, b) =>
  a.position.id === b.position.id &&
  a.position.entry === b.position.entry &&
  a.position.leverage === b.position.leverage &&
  a.position.size === b.position.size &&
  a.position.liq_price === b.position.liq_price &&
  a.mark === b.mark &&
  a.busy === b.busy &&
  a.unit === b.unit &&
  a.onClose === b.onClose
);

export default memo(OpenPositionsLiveImpl);
