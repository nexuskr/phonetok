// IMPERIAL PHASE 4 — Observability event stream (admin-only).
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingList } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { notify, describeError } from "@/lib/notify";
import { setVisibleInterval } from "@/lib/util/visible-interval";

type Row = { id: number; ts: string; kind: string; severity: string; dedupe_key: string | null; payload: any };

const SEVERITIES = ["all","info","warn","error","critical"] as const;

export default function ImperialObservabilityStream() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [sev, setSev] = useState<(typeof SEVERITIES)[number]>("all");

  async function refresh() {
    try {
      const { data, error } = await (supabase as any).rpc("imperial_get_observability_stream", {
        _hours: 6,
        _severity: sev === "all" ? null : sev,
      });
      if (error) throw error;
      setRows((data ?? []) as Row[]);
    } catch (e) {
      notify.error(describeError(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const stop = setVisibleInterval(refresh, 15_000, {
      meta: { owner: "ImperialObservabilityStream", category: "admin" },
    });
    return () => stop();
  }, [sev]);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-bold">🛰️ Imperial Observability (6h)</div>
        <div className="flex gap-1">
          {SEVERITIES.map((s) => (
            <Button key={s} size="sm" variant={sev === s ? "default" : "outline"} onClick={() => setSev(s)}>
              {s}
            </Button>
          ))}
        </div>
      </div>
      {loading ? <LoadingList rows={4} /> : rows.length === 0 ? (
        <EmptyState title="이벤트 없음" description="최근 6시간 내 관측 이벤트가 없습니다." />
      ) : (
        <div className="space-y-1 text-xs font-mono max-h-96 overflow-auto">
          {rows.map((r) => (
            <div key={r.id} className="flex gap-2 border-b border-border/30 py-1">
              <span className="text-muted-foreground tabular-nums">{new Date(r.ts).toLocaleTimeString()}</span>
              <span className={
                r.severity === "critical" ? "text-rose-300 font-bold" :
                r.severity === "error" ? "text-rose-300" :
                r.severity === "warn" ? "text-amber-300" : "text-muted-foreground"
              }>[{r.severity}]</span>
              <span className="font-semibold">{r.kind}</span>
              <span className="text-muted-foreground truncate flex-1">{JSON.stringify(r.payload)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
