/**
 * Admin EV Health 패널.
 * - 수동 실행 버튼 (admin_run_ev_health_now)
 * - 최근 negative_ev 알림 히스토리 (admin_get_ev_history)
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";
import { LoadingList } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Activity, AlertTriangle, CheckCircle2, RefreshCw, Play } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

type EvRow = {
  id: string;
  created_at: string;
  severity: string;
  dedupe_key: string;
  evidence: any;
};

export default function EvHealthAdmin() {
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [history, setHistory] = useState<EvRow[] | null>(null);

  async function loadHistory() {
    const { data, error } = await supabase.rpc("admin_get_ev_history", { _limit: 30 });
    if (error) {
      notify.error("히스토리 로드 실패", { description: error.message });
      setHistory([]);
      return;
    }
    setHistory((data as any) ?? []);
  }

  useEffect(() => {
    void loadHistory();
  }, []);

  async function runNow() {
    setRunning(true);
    const { data, error } = await supabase.rpc("admin_run_ev_health_now");
    setRunning(false);
    if (error) {
      notify.error("EV 점검 실패", { description: error.message });
      return;
    }
    setLastResult(data);
    const alerted = (data as any)?.alerted;
    if (alerted) {
      notify.error("⚠️ 음수 EV 감지", { description: "anomaly_events에 알림이 기록되었습니다." });
    } else {
      notify.success("EV 정상", { description: "음수 EV / zero-loss 위반 없음." });
    }
    void loadHistory();
  }

  return (
    <div className="space-y-4">
      <div className="glass-strong rounded-2xl p-4 neon-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-imperial font-bold text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> 운영자 EV 건전성 점검
          </h3>
          <button
            onClick={runNow}
            disabled={running}
            className="px-4 min-h-[40px] rounded-xl text-xs font-bold bg-gradient-gold text-gold-foreground glow-gold flex items-center gap-1.5 disabled:opacity-50"
          >
            {running ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            지금 즉시 실행
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          전일 운영자 P&L을 점검합니다. `operator_net_pnl &lt; 0` 또는 `zero_loss_check = false`인 경우
          자동으로 anomaly_events(rule=&apos;negative_ev&apos;)에 기록됩니다.
        </p>

        {lastResult && (
          <div className="mt-3 rounded-xl bg-muted/30 p-3 text-xs">
            <div className="font-bold mb-1 flex items-center gap-1.5">
              {(lastResult as any).alerted ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                  <span className="text-destructive">알림 발생</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-500">정상</span>
                </>
              )}
            </div>
            <pre className="text-[10px] text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(lastResult, null, 2)}
            </pre>
          </div>
        )}
      </div>

      <div className="glass-strong rounded-2xl p-4 neon-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-imperial font-bold text-sm">최근 알림 히스토리</h3>
          <button onClick={loadHistory} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> 새로고침
          </button>
        </div>

        {history === null ? (
          <LoadingList rows={3} />
        ) : history.length === 0 ? (
          <EmptyState title="알림 없음" description="아직 음수 EV 감지 이력이 없습니다." />
        ) : (
          <ul className="space-y-2">
            {history.map((r) => (
              <li key={r.id} className="rounded-xl bg-muted/20 p-3 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-destructive flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> {r.dedupe_key}
                  </span>
                  <span className="text-muted-foreground">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: ko })}
                  </span>
                </div>
                <pre className="text-[10px] text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(r.evidence, null, 2)}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
