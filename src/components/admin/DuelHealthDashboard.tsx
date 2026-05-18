// IMPERIAL-SINGULARITY: 24h health dashboard + emergency freeze + alert threshold editor.
// Auto-refresh 15s. Backed by admin_get_duel_health_24h + admin_set_duel_emergency_freeze.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { notify, describeError } from "@/lib/notify";

type Health = {
  bet_volume_24h: number;
  bet_count_24h: number;
  pot_in_24h: number;
  payout_out_24h: number;
  house_edge_actual_bps: number | null;
  house_edge_target_bps: number;
  house_edge_drift_bps: number | null;
  error_count_24h: number;
  telem_count_24h: number;
  error_rate_bps: number;
  active_rooms: number;
  p95_settle_latency_ms: number | null;
  near_miss_buckets: Record<string, number>;
  thresholds: { house_edge_drift_bps: number; error_rate_bps: number };
  generated_at: string;
};

function Card({ label, value, tone = "default", sub }: { label: string; value: string; tone?: "default" | "ok" | "warn" | "alert"; sub?: string }) {
  const toneCls =
    tone === "alert" ? "border-rose-400/60 bg-rose-500/10 text-rose-100"
    : tone === "warn" ? "border-amber-400/50 bg-amber-500/10 text-amber-100"
    : tone === "ok" ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-100"
    : "border-border/50 bg-card/60 text-foreground";
  return (
    <div className={`rounded-xl border backdrop-blur p-3 ${toneCls}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
      <div className="font-mono text-xl mt-1">{value}</div>
      {sub ? <div className="text-[10px] opacity-70 mt-1">{sub}</div> : null}
    </div>
  );
}

export default function DuelHealthDashboard() {
  const [h, setH] = useState<Health | null>(null);
  const [busy, setBusy] = useState(false);
  const [freezeRoom, setFreezeRoom] = useState("");
  const [thresh, setThresh] = useState<{ d: number; e: number }>({ d: 10, e: 5 });

  async function refresh() {
    const { data, error } = await supabase.rpc("admin_get_duel_health_24h");
    if (error) { notify.error(describeError(error)); return; }
    const v = data as unknown as Health;
    setH(v);
    if (v?.thresholds) setThresh({ d: v.thresholds.house_edge_drift_bps, e: v.thresholds.error_rate_bps });
  }

  useEffect(() => {
    void refresh();
    const t = setInterval(() => { void refresh(); }, 15_000);
    return () => clearInterval(t);
  }, []);

  async function toggleFreeze(on: boolean) {
    if (!freezeRoom) { notify.error("room_id 필요"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.rpc("admin_set_duel_emergency_freeze", { _room_id: freezeRoom, _on: on });
      if (error) throw error;
      notify.success(on ? "결투방 동결됨" : "결투방 동결 해제됨");
      await refresh();
    } catch (e) { notify.error(describeError(e)); } finally { setBusy(false); }
  }

  async function saveThresholds() {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("imperial_duel_alert_thresholds")
        .update({ house_edge_drift_bps: thresh.d, error_rate_bps: thresh.e, updated_at: new Date().toISOString() })
        .eq("id", 1);
      if (error) throw error;
      notify.success("Alert thresholds 저장됨");
      await refresh();
    } catch (e) { notify.error(describeError(e)); } finally { setBusy(false); }
  }

  if (!h) return <div className="text-sm text-muted-foreground">Loading health…</div>;

  const driftTone: "ok" | "warn" | "alert" =
    h.house_edge_drift_bps == null ? "warn"
    : h.house_edge_drift_bps > h.thresholds.house_edge_drift_bps ? "alert"
    : h.house_edge_drift_bps > h.thresholds.house_edge_drift_bps / 2 ? "warn" : "ok";

  const errTone: "ok" | "warn" | "alert" =
    h.error_rate_bps > h.thresholds.error_rate_bps ? "alert"
    : h.error_rate_bps > h.thresholds.error_rate_bps / 2 ? "warn" : "ok";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="font-display font-bold text-sm">📈 24h Mission Control</div>
        <div className="text-[10px] text-muted-foreground font-mono">15s auto · {new Date(h.generated_at).toLocaleTimeString()}</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card label="Bet Volume" value={Math.round(h.bet_volume_24h).toLocaleString()} sub={`${h.bet_count_24h.toLocaleString()} bets`} />
        <Card
          label="Edge Drift"
          value={h.house_edge_drift_bps == null ? "—" : `${h.house_edge_drift_bps} bps`}
          tone={driftTone}
          sub={h.house_edge_actual_bps == null ? "no data" : `${(h.house_edge_actual_bps/100).toFixed(2)}% vs ${h.house_edge_target_bps/100}%`}
        />
        <Card label="Error Rate" value={`${h.error_rate_bps} bps`} tone={errTone} sub={`${h.error_count_24h}/${h.telem_count_24h}`} />
        <Card label="p95 Settle" value={h.p95_settle_latency_ms == null ? "—" : `${Math.round(h.p95_settle_latency_ms)}ms`} />
        <Card label="Active Rooms" value={h.active_rooms.toLocaleString()} />
        <Card label="Near-Miss" value={Object.entries(h.near_miss_buckets ?? {}).map(([k,v]) => `${k.slice(0,1).toUpperCase()}${v}`).join(" ") || "—"} />
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-rose-400/40 bg-rose-500/5 backdrop-blur p-4 space-y-2">
          <div className="font-display font-bold text-sm text-rose-200">🧊 Emergency Freeze (방 단위)</div>
          <input value={freezeRoom} onChange={(e) => setFreezeRoom(e.target.value)} placeholder="room_id (uuid)"
            className="w-full rounded-lg bg-background/60 border border-border/50 px-2 py-1.5 text-xs font-mono" />
          <div className="flex gap-2">
            <button disabled={busy} onClick={() => toggleFreeze(true)}
              className="rounded-lg px-3 py-1.5 text-xs font-display font-bold bg-rose-500/20 text-rose-200 border border-rose-400/50 hover:bg-rose-500/30 disabled:opacity-50">
              Freeze ON
            </button>
            <button disabled={busy} onClick={() => toggleFreeze(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-display font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-400/50 hover:bg-emerald-500/30 disabled:opacity-50">
              Freeze OFF
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-400/40 bg-amber-500/5 backdrop-blur p-4 space-y-2">
          <div className="font-display font-bold text-sm text-amber-200">🔔 Alert Thresholds</div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] text-muted-foreground">
              Edge Drift (bps)
              <input type="number" min={1} max={500} value={thresh.d}
                onChange={(e) => setThresh((t) => ({ ...t, d: Math.max(1, Number(e.target.value) || 0) }))}
                className="mt-1 w-full rounded-lg bg-background/60 border border-border/50 px-2 py-1.5 text-xs font-mono" />
            </label>
            <label className="text-[11px] text-muted-foreground">
              Error Rate (bps)
              <input type="number" min={1} max={500} value={thresh.e}
                onChange={(e) => setThresh((t) => ({ ...t, e: Math.max(1, Number(e.target.value) || 0) }))}
                className="mt-1 w-full rounded-lg bg-background/60 border border-border/50 px-2 py-1.5 text-xs font-mono" />
            </label>
          </div>
          <button disabled={busy} onClick={saveThresholds}
            className="rounded-lg px-3 py-1.5 text-xs font-display font-bold bg-amber-500/20 text-amber-200 border border-amber-400/50 hover:bg-amber-500/30 disabled:opacity-50">
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
