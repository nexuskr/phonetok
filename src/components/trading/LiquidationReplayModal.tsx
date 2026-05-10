import { useEffect } from "react";
import { X, Flame, ArrowDown, Shield, Receipt } from "lucide-react";
import { formatKRW } from "@/lib/store";

export interface ReplayPayload {
  symbol: string;
  side: "long" | "short";
  leverage: number;
  margin: number;
  entry: number;
  exit: number;
  pnl: number;
  roi: number;
  feeOpen: number;
  feeClose: number;
  reason: string;
  /** Approx insurance contribution = liquidation→margin or fee*0.25 */
  insuranceShare: number;
  /** Slippage estimate. */
  slippage: number;
  openedAt?: string;
  closedAt?: string;
}

interface Props {
  payload: ReplayPayload | null;
  onClose: () => void;
}

const REASON_LABEL: Record<string, string> = {
  liquidation: "강제 청산 (ROI ≤ -99%)",
  tp: "익절 (TP 자동)",
  sl: "손절 (SL 자동)",
  trailing: "트레일링 스탑",
  manual: "수동 청산",
  cross_maintenance: "Cross 유지증거금 부족",
};

export default function LiquidationReplayModal({ payload, onClose }: Props) {
  useEffect(() => {
    if (!payload) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [payload, onClose]);

  if (!payload) return null;
  const isLoss = payload.pnl < 0;
  const isLiq = payload.reason === "liquidation";
  const headerTone = isLiq ? "from-destructive/30 to-destructive/5" : isLoss ? "from-orange-500/30 to-orange-500/5" : "from-emerald-500/30 to-emerald-500/5";

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
         onClick={onClose}>
      <div className="w-full max-w-md glass-strong rounded-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className={`bg-gradient-to-b ${headerTone} p-4 border-b border-border/40 relative`}>
          <button onClick={onClose} className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <Flame className={`w-5 h-5 ${isLiq ? "text-destructive" : isLoss ? "text-orange-500" : "text-emerald-500"}`} />
            <h2 className="font-display font-black text-lg">포지션 리플레이</h2>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">{REASON_LABEL[payload.reason] ?? payload.reason}</p>

          <div className="mt-3 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-muted-foreground">{payload.symbol} · {payload.side.toUpperCase()} · {payload.leverage}×</div>
              <div className={`font-display font-black text-2xl tabular-nums ${payload.pnl >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                {payload.pnl >= 0 ? "+" : ""}{formatKRW(payload.pnl)}
              </div>
              <div className={`text-[11px] tabular-nums ${payload.roi >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                ROI {payload.roi >= 0 ? "+" : ""}{(payload.roi * 100).toFixed(2)}%
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Row label="진입가" value={payload.entry.toLocaleString(undefined, { maximumFractionDigits: 4 })} />
            <div className="flex justify-center text-muted-foreground">
              <ArrowDown className="w-4 h-4 animate-pulse" />
            </div>
            <Row label="청산가" value={payload.exit.toLocaleString(undefined, { maximumFractionDigits: 4 })} bold />
          </div>

          <div className="border-t border-border/40 pt-3 grid grid-cols-2 gap-2">
            <Mini label="증거금" value={formatKRW(payload.margin)} />
            <Mini label="슬리피지(추정)" value={formatKRW(payload.slippage)} />
            <Mini label="진입 수수료" value={formatKRW(payload.feeOpen)} />
            <Mini label="청산 수수료" value={formatKRW(payload.feeClose)} />
          </div>

          <div className="rounded-xl bg-primary/10 border border-primary/30 p-2.5 flex items-start gap-2">
            <Shield className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <div className="font-bold text-primary">보험펀드 기여</div>
              <div className="text-muted-foreground">
                +{formatKRW(payload.insuranceShare)} (이번 거래에서 보험펀드로 적립)
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-card/40 border border-border/40 p-2.5 flex items-start gap-2">
            <Receipt className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed flex-1">
              <div className="font-bold">최종 정산</div>
              <div className="text-muted-foreground tabular-nums">
                {formatKRW(payload.margin)} {payload.pnl >= 0 ? "+" : "-"} {formatKRW(Math.abs(payload.pnl))} - {formatKRW(payload.feeClose)} = <span className="text-foreground font-bold">{formatKRW(Math.max(0, payload.margin + payload.pnl - payload.feeClose))}</span>
              </div>
            </div>
          </div>

          <button onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-gradient-gold text-gold-foreground font-bold text-sm">
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${bold ? "font-black" : ""}`}>{value}</span>
    </div>
  );
}
function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-card/40 border border-border/30 p-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-xs font-bold tabular-nums">{value}</div>
    </div>
  );
}
