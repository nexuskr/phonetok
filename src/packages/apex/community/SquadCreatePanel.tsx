import { useState } from "react";
import { Users, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { notify, describeError } from "@/lib/notify";

export function SquadCreatePanel({ onCreated }: { onCreated: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [joinId, setJoinId] = useState("");

  async function create() {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("apex_create_squad" as any);
      if (error) throw error;
      const res = data as any;
      if (!res?.ok) { notify.warning(res?.error ?? "생성 실패"); return; }
      onCreated(res.squad_id);
      notify.passive("스쿼드 생성 완료", { description: "최대 3명 — 친구를 초대하세요" });
    } catch (e) { notify.error("스쿼드 오류", { description: describeError(e) }); }
    finally { setBusy(false); }
  }

  async function join() {
    if (!/^[0-9a-f-]{36}$/i.test(joinId)) { notify.warning("유효한 스쿼드 ID가 아닙니다"); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("apex_join_squad" as any, { _squad_id: joinId });
      if (error) throw error;
      const res = data as any;
      if (!res?.ok) { notify.warning(res?.error ?? "참가 실패"); return; }
      onCreated(res.squad_id);
      notify.passive("스쿼드 참가 완료");
    } catch (e) { notify.error("참가 오류", { description: describeError(e) }); }
    finally { setBusy(false); }
  }

  return (
    <div className="rounded-xl border border-border bg-card/50">
      <div className="p-5 space-y-4">
        <h2 className="text-xl font-black flex items-center gap-2">
          <Users className="w-5 h-5" /> 스쿼드 생성 / 참가
        </h2>
        <button onClick={create} disabled={busy}
          className="w-full rounded-lg bg-primary text-primary-foreground px-4 py-2 font-bold disabled:opacity-50">
          {busy ? "…" : "새 스쿼드 만들기 (호스트)"}
        </button>
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground">스쿼드 ID로 참가</label>
          <div className="flex gap-2">
            <input value={joinId} onChange={(e) => setJoinId(e.target.value.trim())}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="flex-1 rounded-lg bg-input border border-border px-3 py-2 text-xs font-mono" />
            <button onClick={join} disabled={busy || !joinId}
              className="rounded-lg bg-secondary text-secondary-foreground px-4 disabled:opacity-50">
              <Link2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
