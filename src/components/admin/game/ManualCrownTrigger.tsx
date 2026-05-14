/**
 * Manual Crown Trigger — 관리자가 특정 유저에게 즉시 Crown 발행
 * idempotency_key = manual:admin:uid:ts (서버 강제)
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notify } from "@/lib/notify";
import { Rocket, Crown } from "lucide-react";

export default function ManualCrownTrigger() {
  const [uid, setUid] = useState("");
  const [base, setBase] = useState(100);
  const [mult, setMult] = useState(1.5);
  const [reason, setReason] = useState("이벤트 보상");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<any>(null);

  const fire = async () => {
    if (!uid.trim()) return notify.warning("대상 UUID를 입력하세요");
    if (!confirm(`정말로 ${uid.slice(0, 8)}…에게 Crown ${base}×${mult} = ${Math.floor(base * mult)}₡ 를 발행할까요?`)) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_trigger_crown" as any, {
      _uid: uid.trim(),
      _multiplier: mult,
      _base: base,
      _reason: reason,
    });
    setBusy(false);
    if (error) return notify.error(error.message);
    setLast(data);
    if ((data as any).duplicate) {
      notify.warning("동일 idem 키 — 중복 방지로 무시됨");
    } else {
      notify.success(`Crown ${(data as any).awarded}₡ 발행 완료`);
    }
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display font-black text-xl sm:text-2xl">
          <Rocket className="inline h-5 w-5 mr-1" /> Manual Crown Trigger
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          멱등키 <code className="font-mono">manual:admin:uid:timestamp</code> 자동 생성 — 동일 키 중복 발행 차단
        </p>
      </header>

      <div className="glass-strong rounded-2xl p-5 border border-yellow-500/40 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label>대상 user_id (UUID)</Label>
            <Input value={uid} onChange={(e) => setUid(e.target.value)} className="font-mono" placeholder="00000000-0000-0000-0000-000000000000" />
          </div>
          <div>
            <Label>Base Amount (0~100,000)</Label>
            <Input type="number" min={0} max={100000} value={base} onChange={(e) => setBase(Number(e.target.value))} />
          </div>
          <div>
            <Label>Multiplier (0.1~10)</Label>
            <Input type="number" min={0.1} max={10} step={0.1} value={mult} onChange={(e) => setMult(Number(e.target.value))} />
          </div>
          <div className="sm:col-span-2">
            <Label>사유 (감사 로그에 기록됨)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          <div className="text-sm">
            예상 발행: <span className="font-display font-black text-2xl bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">{Math.floor(base * mult).toLocaleString()}</span> ₡
          </div>
          <Button onClick={fire} disabled={busy} size="lg" className="bg-gradient-to-r from-yellow-500 to-orange-500">
            <Crown className="h-4 w-4 mr-1" /> {busy ? "발행 중…" : "Crown 발행"}
          </Button>
        </div>

        {last && (
          <div className="text-xs font-mono bg-muted/30 rounded p-3 mt-2">
            <div>event_id: {last.event_id ?? "(중복)"}</div>
            <div>awarded: {last.awarded}</div>
            <div>idem: {last.idempotency_key}</div>
            <div>duplicate: {String(last.duplicate)}</div>
          </div>
        )}
      </div>
    </div>
  );
}
