import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertOctagon, ShieldAlert, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { notify, describeError } from "@/lib/notify";

type KPI = Record<string, any> | null;

/**
 * Phase 4 P1 Hyperion — Apocalypse Protocol.
 * - Surfaces anomaly_score and fraud_rejects.
 * - Preemptive Warm King Mercy: yellow warn at >=0.08%.
 * - Auto-arm: anomaly > 0.1% for 3 consecutive ticks → one-click rollback.
 * - Admin-only. AAL2 enforced server-side on RPC.
 */
export default function ApocalypseProtocolPanel({ kpi }: { kpi: KPI }) {
  const [breachStreak, setBreachStreak] = useState(0);
  const [busy, setBusy] = useState(false);

  const anomaly = Number(kpi?.anomaly_score ?? 0);
  const fraud = Number(kpi?.fraud_rejects_24h ?? 0);
  const paused = Boolean(kpi?.auto_pause);

  useEffect(() => {
    if (anomaly > 0.001) setBreachStreak((n) => n + 1);
    else setBreachStreak(0);
  }, [anomaly, kpi]);

  const warnPreemptive = anomaly >= 0.0008 && anomaly < 0.001;
  const armed = breachStreak >= 3;

  async function pause() {
    if (!confirm("Phase 1 긴급 정지를 호출합니다. 계속할까요?")) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("imperial_phase1_emergency_pause", { _reason: "manual_apocalypse" } as any);
      if (error) throw error;
      notify.success("Phase 1 일시 정지 완료");
    } catch (e) { notify.error(describeError(e)); }
    finally { setBusy(false); }
  }

  async function rollback() {
    if (!confirm("자동 롤백을 실행합니다 (Phase 1 정지 + Rollout → 0). 계속할까요?")) return;
    setBusy(true);
    try {
      const a = await supabase.rpc("imperial_phase1_emergency_pause", { _reason: "auto_rollback" } as any);
      if (a.error) throw a.error;
      const b = await supabase.rpc("imperial_rollout_activate", { _phase: 0 } as any);
      if (b.error) throw b.error;
      notify.success("Auto-Rollback 완료 (≤10분 이내 복구)");
    } catch (e) { notify.error(describeError(e)); }
    finally { setBusy(false); }
  }

  const tone =
    paused ? "border-rose-400/50 from-rose-950/20" :
    armed ? "border-rose-400/50 from-rose-950/20" :
    warnPreemptive ? "border-amber-400/50 from-amber-950/20" :
    "border-emerald-400/30 from-emerald-950/10";

  return (
    <Card className={`p-4 space-y-3 bg-gradient-to-br ${tone} to-background`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertOctagon className="h-5 w-5 text-amber-300" />
          <h3 className="text-sm font-bold">🜲 Apocalypse Protocol</h3>
          {paused && <span className="rounded bg-rose-500/20 px-2 py-0.5 text-xs font-bold text-rose-200">PAUSED</span>}
          {!paused && armed && <span className="rounded bg-rose-500/20 px-2 py-0.5 text-xs font-bold text-rose-200">AUTO-ROLLBACK ARMED</span>}
          {!paused && !armed && warnPreemptive && <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-200">⚠ WARM KING MERCY</span>}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={busy || paused} onClick={pause}>
            <ShieldAlert className="mr-1 h-3.5 w-3.5" /> Pause
          </Button>
          <Button size="sm" variant={armed ? "destructive" : "outline"} disabled={busy} onClick={rollback}>
            <Activity className="mr-1 h-3.5 w-3.5" /> Auto-Rollback
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-xs">
        <Stat label="Anomaly score" value={(anomaly * 100).toFixed(3) + "%"} highlight={anomaly >= 0.001} />
        <Stat label="Fraud rejects 24h" value={fraud} />
        <Stat label="Breach streak" value={`${breachStreak}/3`} highlight={breachStreak >= 3} />
      </div>

      <p className="text-[10px] text-muted-foreground">
        Trigger: anomaly_score &gt; 0.1% × 3틱 연속 → 자동 ARM. ≥0.08%는 사전 경고 (Warm King Mercy). 롤백 완료 SLA ≤10분.
      </p>
    </Card>
  );
}

function Stat({ label, value, highlight }: { label: string; value: any; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-2 ${highlight ? "border-rose-400/50 bg-rose-500/10" : "border-border/50 bg-card/40"}`}>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-lg font-bold tabular-nums ${highlight ? "text-rose-200" : ""}`}>{value}</div>
    </div>
  );
}
