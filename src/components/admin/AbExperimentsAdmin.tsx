/**
 * Admin A/B 실험 관리 패널.
 * - 활성/비활성 토글 (admin_set_ab_active)
 * - 현재 variant별 할당 수 (admin_get_ab_stats)
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";
import { LoadingList } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { FlaskConical, ToggleLeft, ToggleRight, RefreshCw } from "lucide-react";

type Experiment = {
  experiment_key: string;
  label: string;
  description: string | null;
  variants: Array<{ name: string; weight: number }>;
  is_active: boolean;
  updated_at: string;
};

type StatRow = { variant: string; assignments: number };

export default function AbExperimentsAdmin() {
  const [list, setList] = useState<Experiment[] | null>(null);
  const [stats, setStats] = useState<Record<string, StatRow[]>>({});
  const [saving, setSaving] = useState<string | null>(null);

  async function loadAll() {
    const { data, error } = await supabase
      .from("ab_experiments")
      .select("experiment_key, label, description, variants, is_active, updated_at")
      .order("experiment_key");
    if (error) {
      notify.error("실험 목록 로드 실패", { description: error.message });
      setList([]);
      return;
    }
    const items = (data ?? []) as any as Experiment[];
    setList(items);
    const all: Record<string, StatRow[]> = {};
    await Promise.all(
      items.map(async (e) => {
        const { data: s } = await supabase.rpc("admin_get_ab_stats", { _key: e.experiment_key });
        all[e.experiment_key] = ((s as any) ?? []) as StatRow[];
      })
    );
    setStats(all);
  }

  useEffect(() => {
    void loadAll();
  }, []);

  async function toggle(key: string, next: boolean) {
    setSaving(key);
    const { error } = await supabase.rpc("admin_set_ab_active", { _key: key, _active: next });
    setSaving(null);
    if (error) {
      notify.error("토글 실패", { description: error.message });
      return;
    }
    notify.success(`${key} ${next ? "활성화" : "비활성화"}`);
    void loadAll();
  }

  if (list === null) return <LoadingList rows={3} />;
  if (list.length === 0) return <EmptyState title="실험이 없습니다" description="ab_experiments에 등록된 실험이 없습니다." />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-imperial font-bold text-sm flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-primary" /> A/B 실험
        </h3>
        <button onClick={loadAll} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> 새로고침
        </button>
      </div>

      {list.map((e) => {
        const total = (stats[e.experiment_key] ?? []).reduce((a, r) => a + Number(r.assignments), 0);
        return (
          <div key={e.experiment_key} className="glass-strong rounded-2xl p-4 neon-border">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <div className="font-bold text-sm break-keep">{e.label}</div>
                <div className="text-[11px] text-muted-foreground font-mono">{e.experiment_key}</div>
                {e.description && <p className="text-xs text-muted-foreground mt-1 break-keep">{e.description}</p>}
              </div>
              <button
                onClick={() => toggle(e.experiment_key, !e.is_active)}
                disabled={saving === e.experiment_key}
                className={`shrink-0 px-3 min-h-[40px] rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 ${
                  e.is_active
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                    : "bg-muted/30 text-muted-foreground"
                }`}
              >
                {e.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                {e.is_active ? "활성" : "비활성"}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3">
              {e.variants.map((v) => {
                const rec = (stats[e.experiment_key] ?? []).find((s) => s.variant === v.name);
                const count = rec ? Number(rec.assignments) : 0;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={v.name} className="rounded-xl bg-muted/20 p-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{v.name}</span>
                      <span className="text-muted-foreground">weight {v.weight}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      할당: <span className="text-foreground font-bold">{count.toLocaleString()}</span> ({pct}%)
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground">
              총 할당: {total.toLocaleString()} · 업데이트 {new Date(e.updated_at).toLocaleString("ko-KR")}
            </div>
          </div>
        );
      })}
    </div>
  );
}
