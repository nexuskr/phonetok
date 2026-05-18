// IMPERIAL-SINGULARITY v3.5-H: Emergency Freeze All + per-switch row + audit.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { notify, describeError } from "@/lib/notify";
import { LoadingList } from "@/components/ui/loading-state";

type Row = { key: string; enabled: boolean; reason: string | null; updated_at: string };

const SWITCHES = ["imperial_betting","imperial_flywheel","imperial_withdrawal","imperial_burn","imperial_nft_mint"];

export default function FlywheelEmergencyPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const { data, error } = await (supabase as any)
        .from("imperial_kill_switches").select("key, enabled, reason, updated_at")
        .in("key", SWITCHES).order("key");
      if (error) throw error;
      setRows((data ?? []) as Row[]);
    } catch (e) { notify.error(describeError(e)); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);

  async function setKill(key: string, enabled: boolean) {
    if (!confirm(`${key} ${enabled ? "ENABLE (freeze)" : "DISABLE (unfreeze)"} 확실합니까?`)) return;
    try {
      const { error } = await (supabase as any).rpc("admin_set_imperial_kill_switch",
        { _key: key, _enabled: enabled, _reason: reason || null });
      if (error) throw error;
      notify.success(`${key} ${enabled ? "ON" : "OFF"}`);
      refresh();
    } catch (e) { notify.error(describeError(e)); }
  }

  async function freezeAll() {
    if (!reason) { notify.error("사유 입력 필수"); return; }
    if (!confirm("⚠️ FREEZE ALL — 모든 Imperial 시스템 정지. 진행?")) return;
    try {
      const { error } = await (supabase as any).rpc("emergency_freeze_all", { _reason: reason });
      if (error) throw error;
      notify.success("FREEZE ALL 실행");
      refresh();
    } catch (e) { notify.error(describeError(e)); }
  }

  async function unfreezeAll() {
    if (!reason) { notify.error("사유 입력 필수"); return; }
    if (!confirm("UNFREEZE ALL — 모든 스위치 OFF. 진행?")) return;
    try {
      const { error } = await (supabase as any).rpc("emergency_unfreeze_all", { _reason: reason });
      if (error) throw error;
      notify.success("UNFREEZE ALL 실행");
      refresh();
    } catch (e) { notify.error(describeError(e)); }
  }

  if (loading) return <LoadingList rows={5} />;

  return (
    <Card className="p-4 border-rose-500/40">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-rose-300">🚨 Imperial Emergency Controls</div>
      </div>
      <div className="mt-3 flex gap-2">
        <Input placeholder="사유 (필수)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button variant="destructive" onClick={freezeAll}>FREEZE ALL</Button>
        <Button variant="outline" onClick={unfreezeAll}>UNFREEZE ALL</Button>
      </div>
      <div className="mt-4 space-y-1.5">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between text-xs">
            <div>
              <span className="font-mono">{r.key}</span>
              {r.enabled && r.reason && <span className="ml-2 text-rose-300/80">— {r.reason}</span>}
            </div>
            <Button size="sm" variant={r.enabled ? "destructive" : "outline"}
              onClick={() => setKill(r.key, !r.enabled)}>
              {r.enabled ? "ON — 끄기" : "OFF — 켜기"}
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
