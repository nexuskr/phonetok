import { useMemo } from "react";
import { Clock, AlertTriangle, ShieldCheck, Timer } from "lucide-react";

interface WRLike {
  status: string;
  process_by: string;
  amount: number;
  created_at: string;
}

interface Props {
  list: WRLike[];
}

/**
 * 출금 SLA 실시간 요약 — 약속한 process_by 까지 남은 시간 기준으로
 * pending / at_risk(≤30분) / breached(초과) 건수와 누적 금액을 보여줍니다.
 */
export default function WithdrawSlaCard({ list }: Props) {
  const stats = useMemo(() => {
    const now = Date.now();
    const active = list.filter((r) => ["pending", "approved", "processing"].includes(r.status));
    let atRisk = 0, breached = 0, healthy = 0;
    let breachedAmt = 0, atRiskAmt = 0;
    let oldestBreachMin = 0;

    for (const r of active) {
      const due = new Date(r.process_by).getTime();
      const diffMin = (due - now) / 60_000;
      if (diffMin < 0) {
        breached += 1;
        breachedAmt += r.amount;
        const breachMin = -diffMin;
        if (breachMin > oldestBreachMin) oldestBreachMin = breachMin;
      } else if (diffMin <= 30) {
        atRisk += 1;
        atRiskAmt += r.amount;
      } else {
        healthy += 1;
      }
    }

    const total = active.length;
    const slaRate = total === 0 ? 100 : Math.round(((healthy + atRisk) / total) * 100);

    return { total, healthy, atRisk, breached, breachedAmt, atRiskAmt, slaRate, oldestBreachMin };
  }, [list]);

  const tone =
    stats.breached > 0 ? "from-destructive/20 to-transparent border-destructive/40" :
    stats.atRisk > 0  ? "from-accent/20 to-transparent border-accent/40" :
    "from-success/20 to-transparent border-success/40";

  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${tone} p-4 sm:p-5`}>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-2">
          <Timer className="w-5 h-5 text-primary" />
          <h3 className="font-imperial text-sm tracking-[0.18em] font-bold">출금 SLA 현황</h3>
        </div>
        <div className="flex items-baseline gap-1">
          <span className={`font-imperial text-3xl font-bold tabular-nums ${stats.breached > 0 ? "text-destructive" : stats.atRisk > 0 ? "text-accent" : "text-success"}`}>
            {stats.slaRate}
          </span>
          <span className="text-xs text-muted-foreground font-bold">% SLA</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <Tile
          icon={Clock}
          label="진행 중"
          value={stats.total}
          tone="muted"
        />
        <Tile
          icon={ShieldCheck}
          label="정상"
          value={stats.healthy}
          tone="success"
        />
        <Tile
          icon={Clock}
          label="임박 (≤30분)"
          value={stats.atRisk}
          sub={stats.atRiskAmt > 0 ? `₩${stats.atRiskAmt.toLocaleString()}` : undefined}
          tone="accent"
        />
        <Tile
          icon={AlertTriangle}
          label="SLA 초과"
          value={stats.breached}
          sub={
            stats.breached > 0
              ? `최대 ${Math.round(stats.oldestBreachMin)}분 지연 · ₩${stats.breachedAmt.toLocaleString()}`
              : undefined
          }
          tone="destructive"
        />
      </div>
    </div>
  );
}

type Tone = "muted" | "success" | "accent" | "destructive";

function Tile({
  icon: Icon, label, value, sub, tone,
}: { icon: any; label: string; value: number; sub?: string; tone: Tone }) {
  const cls =
    tone === "success" ? "bg-success/10 text-success" :
    tone === "accent" ? "bg-accent/10 text-accent" :
    tone === "destructive" ? "bg-destructive/10 text-destructive" :
    "bg-muted/30 text-muted-foreground";
  return (
    <div className="glass rounded-xl p-3">
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold ${cls}`}>
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className="font-imperial text-2xl font-bold tabular-nums mt-2">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-1 break-keep leading-tight">{sub}</div>}
    </div>
  );
}
