import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingList } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { notify } from "@/lib/notify";

type SummaryRow = { kind: string; game_code: string; n: number; last_at: string };
type AnomalyRow = {
  id: string;
  user_id: string | null;
  game_code: string | null;
  kind: string;
  expected: number | null;
  actual: number | null;
  meta: Record<string, unknown>;
  created_at: string;
};

const KINDS = ["spin_failed", "sound_init_failed", "payout_mismatch", "overlay_timeout"] as const;

const KIND_TONE: Record<string, string> = {
  payout_mismatch: "bg-red-500/15 text-red-300 border-red-500/40",
  overlay_timeout: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  spin_failed: "bg-orange-500/15 text-orange-300 border-orange-500/40",
  sound_init_failed: "bg-zinc-500/15 text-zinc-300 border-zinc-500/40",
};

export default function SlotAnomalyPanel() {
  const [summary, setSummary] = useState<SummaryRow[] | null>(null);
  const [rows, setRows] = useState<AnomalyRow[] | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: s }, { data: r }] = await Promise.all([
        supabase.rpc("admin_get_slot_anomaly_summary_24h" as any),
        supabase.rpc("admin_list_slot_anomalies" as any, { _kind: filter, _limit: 100 }),
      ]);
      setSummary((s as SummaryRow[]) ?? []);
      setRows((r as AnomalyRow[]) ?? []);
    } catch (e: any) {
      notify.error(e?.message ?? "load_failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const total = summary?.reduce((a, b) => a + Number(b.n), 0) ?? 0;
  const byKind = (k: string) =>
    summary?.filter((s) => s.kind === k).reduce((a, b) => a + Number(b.n), 0) ?? 0;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold tracking-wider text-foreground">SLOT ANOMALIES · 24h</h3>
          <Badge variant="outline" className="text-xs">{total}</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {KINDS.map((k) => (
          <button
            key={k}
            onClick={() => setFilter(filter === k ? null : k)}
            className={`px-3 py-2 rounded-lg border text-left transition ${
              filter === k ? KIND_TONE[k] : "border-border/40 hover:border-border"
            }`}
          >
            <div className="text-[10px] uppercase tracking-widest opacity-70">{k.replace(/_/g, " ")}</div>
            <div className="text-xl font-mono font-bold tabular-nums">{byKind(k)}</div>
          </button>
        ))}
      </div>

      {/* Drill-down list */}
      <div className="rounded-lg border border-border/40 overflow-hidden">
        <div className="px-3 py-1.5 text-[10px] tracking-widest text-muted-foreground bg-muted/30 flex items-center justify-between">
          <span>RECENT {filter ? `· ${filter}` : ""}</span>
          {filter && (
            <button className="underline opacity-70 hover:opacity-100" onClick={() => setFilter(null)}>
              clear
            </button>
          )}
        </div>
        {rows === null ? (
          <div className="p-3"><LoadingList rows={4} /></div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<AlertTriangle className="w-5 h-5" />}
            title="이상 없음"
            description="최근 24시간 동안 적재된 슬롯 이상치가 없습니다."
          />
        ) : (
          <div className="divide-y divide-border/40 max-h-[420px] overflow-y-auto">
            {rows.map((r) => {
              const drift =
                r.expected != null && r.actual != null
                  ? Number(r.actual) - Number(r.expected)
                  : null;
              return (
                <div key={r.id} className="px-3 py-2 text-xs flex items-start gap-2">
                  <Badge variant="outline" className={`${KIND_TONE[r.kind] ?? ""} shrink-0`}>{r.kind}</Badge>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-[11px] text-muted-foreground truncate">
                      {r.game_code ?? "—"} · {new Date(r.created_at).toLocaleString()}
                    </div>
                    {(r.expected != null || r.actual != null) && (
                      <div className="font-mono text-[11px] mt-0.5">
                        exp <span className="text-foreground">{r.expected ?? "—"}</span> ·
                        act <span className="text-foreground">{r.actual ?? "—"}</span>
                        {drift !== null && (
                          <span className={`ml-2 ${Math.abs(drift) > 1 ? "text-red-400" : "text-emerald-400"}`}>
                            Δ {drift > 0 ? "+" : ""}{drift}
                          </span>
                        )}
                      </div>
                    )}
                    {r.meta && Object.keys(r.meta).length > 0 && (
                      <pre className="mt-1 text-[10px] text-muted-foreground/80 whitespace-pre-wrap break-all max-h-20 overflow-hidden">
                        {JSON.stringify(r.meta)}
                      </pre>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
