// IMPERIAL-SINGULARITY v3.5-H: Recent injection events + one-click rollback.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { notify, describeError } from "@/lib/notify";
import { LoadingList } from "@/components/ui/loading-state";

type Ev = {
  id: string; ts: string; trigger_tier: string | null;
  amount_in: number; reason: string; rolled_back_at: string | null;
};

export default function FlywheelRollbackPanel() {
  const [rows, setRows] = useState<Ev[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const { data, error } = await (supabase as any)
        .from("imperial_injection_events")
        .select("id, ts, trigger_tier, amount_in, reason, rolled_back_at")
        .order("ts", { ascending: false }).limit(50);
      if (error) throw error;
      setRows((data ?? []) as Ev[]);
    } catch (e) { notify.error(describeError(e)); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);

  async function rollback(id: string) {
    const reason = window.prompt("Rollback 사유:");
    if (!reason) return;
    if (!confirm(`Injection ${id.slice(0,8)}… ROLLBACK 진행?`)) return;
    try {
      const { error } = await (supabase as any).rpc("rollback_injection_event",
        { _event_id: id, _reason: reason });
      if (error) throw error;
      notify.success("Rollback 완료");
      refresh();
    } catch (e) { notify.error(describeError(e)); }
  }

  if (loading) return <LoadingList rows={3} />;

  return (
    <Card className="p-4">
      <div className="text-xs font-bold mb-3">⏪ Injection Rollback (50)</div>
      {rows.length === 0 ? (
        <div className="text-xs text-muted-foreground">최근 인젝션 없음</div>
      ) : (
        <div className="space-y-1 text-xs font-mono max-h-72 overflow-auto">
          {rows.map((e) => (
            <div key={e.id} className="flex items-center justify-between border-b border-border/30 py-1.5">
              <span className="text-muted-foreground w-44 truncate">{new Date(e.ts).toLocaleString()}</span>
              <span className="w-16">{e.trigger_tier ?? "-"}</span>
              <span className="tabular-nums w-28 text-right">{Number(e.amount_in).toLocaleString()}</span>
              <span className="text-muted-foreground truncate flex-1 px-2">{e.reason}</span>
              {e.rolled_back_at ? (
                <span className="text-rose-300">ROLLED BACK</span>
              ) : (
                <Button size="sm" variant="outline" onClick={() => rollback(e.id)}>Rollback</Button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
