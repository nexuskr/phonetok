// IMPERIAL-SINGULARITY v3.5-H: Limited Rollout consent + risk warning.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { notify, describeError } from "@/lib/notify";

type State = { tier: number; consented: boolean; betting_allowed: boolean; can_play: boolean; daily_cap_phon: number | null };

export default function ImperialRolloutGate({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id; if (!uid) { setLoading(false); return; }
      const { data, error } = await (supabase as any).rpc("imperial_can_participate", { _user: uid });
      if (error) throw error;
      setS(data as State);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function consent() {
    try {
      const { error } = await (supabase as any).rpc("imperial_record_consent");
      if (error) throw error;
      notify.success("Imperial 동의 완료");
      load();
    } catch (e) { notify.error(describeError(e)); }
  }

  if (loading) return null;
  if (!s) return <>{children}</>;
  if (s.can_play) return <>{children}</>;

  return (
    <Card className="p-6 border-amber-500/30 bg-gradient-to-br from-amber-950/40 to-rose-950/30">
      <div className="text-[10px] tracking-[0.4em] uppercase text-amber-300/80">Imperial Limited Rollout</div>
      <div className="font-display font-black text-2xl mt-2 text-amber-100">초대받은 폐하만 출진 가능합니다</div>
      <ul className="mt-4 space-y-1.5 text-sm text-amber-100/80">
        <li>• 본 모드는 실제 PHON이 사용됩니다.</li>
        <li>• Tier 1: 일일 50,000 PHON · Tier 2: 250,000 PHON · Tier 3: 무제한</li>
        <li>• 손실 가능성을 충분히 이해하고 책임지신다는 의사를 확인합니다.</li>
        {s.tier === 0 && <li className="text-rose-300">• 현재 등급: Tier 0 (출진 권한 없음 — 관리자에게 문의)</li>}
        {!s.betting_allowed && <li className="text-rose-300">• 베팅이 일시 정지되어 있습니다.</li>}
      </ul>
      <div className="mt-5 flex gap-2">
        {s.tier > 0 && !s.consented && s.betting_allowed && (
          <Button onClick={consent} className="bg-amber-500 text-amber-950 hover:bg-amber-400">동의하고 입장</Button>
        )}
        <Button variant="outline" onClick={load}>새로고침</Button>
      </div>
    </Card>
  );
}
