/**
 * Risk / Anomaly Center (Day 2)
 * anomaly_events 통합 피드 + 1-click resolve + realtime
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { LoadingCard } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { notify } from "@/lib/notify";
import { AlertTriangle, ShieldCheck } from "lucide-react";

type Anomaly = {
  id: string;
  user_id: string | null;
  rule: string;
  severity: string;
  evidence: any;
  acknowledged: boolean;
  created_at: string;
};

export default function RiskCenter() {
  const [rows, setRows] = useState<Anomaly[] | null>(null);
  const [unackOnly, setUnackOnly] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});

  const load = async () => {
    const { data, error } = await supabase.rpc("admin_get_risk_feed" as any, {
      _only_unack: unackOnly,
      _limit: 200,
    });
    if (error) return notify.error(error.message);
    setRows((data as any) ?? []);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("admin:risk:" + Math.random().toString(36).slice(2))
      .on("postgres_changes", { event: "*", schema: "public", table: "anomaly_events" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unackOnly]);

  const resolve = async (id: string) => {
    setResolving(id);
    const { error } = await supabase.rpc("admin_resolve_anomaly" as any, {
      _id: id,
      _note: note[id] ?? null,
    });
    setResolving(null);
    if (error) return notify.error(error.message);
    notify.success("처리 완료");
    load();
  };

  const sevColor = (s: string) =>
    s === "critical" || s === "high" ? "text-red-400" : s === "warn" ? "text-amber-400" : "text-muted-foreground";

  if (rows === null) return <LoadingCard />;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-black text-xl sm:text-2xl">
            <AlertTriangle className="inline h-5 w-5 mr-1 text-amber-400" /> 리스크 알림 센터
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            이상감지 통합 피드 — 멀티계정·VPN·니어미스 조작·출금 속도 등
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="unack" className="text-xs">미처리만</Label>
          <Switch id="unack" checked={unackOnly} onCheckedChange={setUnackOnly} />
        </div>
      </header>

      {rows.length === 0 ? (
        <EmptyState title="알림 없음" description="모든 이상감지가 처리되었습니다." icon={<ShieldCheck className="h-6 w-6" />} />
      ) : (
        <div className="space-y-2">
          {rows.map((a) => (
            <div key={a.id} className="glass-strong rounded-xl p-3 border border-border/40">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold uppercase ${sevColor(a.severity)}`}>{a.severity}</span>
                    <span className="text-sm font-mono">{a.rule}</span>
                    {a.user_id && (
                      <span className="text-[11px] text-muted-foreground font-mono">user: {a.user_id.slice(0, 8)}…</span>
                    )}
                    <span className="text-[11px] text-muted-foreground ml-auto">
                      {new Date(a.created_at).toLocaleString("ko-KR")}
                    </span>
                  </div>
                  {a.evidence && Object.keys(a.evidence).length > 0 && (
                    <pre className="mt-1 text-[10px] text-muted-foreground bg-muted/20 rounded p-2 overflow-x-auto">
                      {JSON.stringify(a.evidence, null, 2)}
                    </pre>
                  )}
                </div>
                {!a.acknowledged && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Input
                      placeholder="메모 (선택)"
                      value={note[a.id] ?? ""}
                      onChange={(e) => setNote({ ...note, [a.id]: e.target.value })}
                      className="h-8 w-32"
                    />
                    <Button size="sm" onClick={() => resolve(a.id)} disabled={resolving === a.id}>
                      처리
                    </Button>
                  </div>
                )}
                {a.acknowledged && <span className="text-xs text-emerald-400 shrink-0">✓ 처리됨</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
