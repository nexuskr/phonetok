// IMPERIAL PHASE 4 — Auto-Heal log viewer (admin).
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { LoadingList } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { notify, describeError } from "@/lib/notify";
import { setVisibleInterval } from "@/lib/util/visible-interval";

type Row = { id: number; ts: string; kind: string; severity: string; payload: any };

export default function ImperialAutoHealPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const { data, error } = await (supabase as any).rpc("imperial_get_auto_heal_log", { _hours: 24 });
      if (error) throw error;
      setRows((data ?? []) as Row[]);
    } catch (e) { notify.error(describeError(e)); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    refresh();
    const stop = setVisibleInterval(refresh, 30_000, { meta: { owner: "ImperialAutoHealPanel", category: "admin" } });
    return () => stop();
  }, []);

  const warns = rows.filter((r) => r.severity !== "info").length;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-bold">🔧 Auto-Heal (24h)</div>
        <div className="text-[11px] text-muted-foreground">
          총 {rows.length} · 경고 <span className={warns > 0 ? "text-amber-300 font-bold" : ""}>{warns}</span>
        </div>
      </div>
      {loading ? <LoadingList rows={4} /> : rows.length === 0 ? (
        <EmptyState title="기록 없음" description="cron이 아직 시작되지 않았습니다." />
      ) : (
        <div className="space-y-1 text-xs font-mono max-h-72 overflow-auto">
          {rows.map((r) => (
            <div key={r.id} className="flex gap-2 border-b border-border/30 py-1">
              <span className="text-muted-foreground tabular-nums">{new Date(r.ts).toLocaleTimeString()}</span>
              <span className={r.severity !== "info" ? "text-amber-300 font-bold" : "text-muted-foreground"}>
                [{r.severity}]
              </span>
              <span>{r.kind}</span>
              <span className="text-muted-foreground truncate flex-1">{JSON.stringify(r.payload)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
