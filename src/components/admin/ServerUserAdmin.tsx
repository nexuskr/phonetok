import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { adminSetTier, adminAdjustBalance } from "@/lib/deposits-rpc";
import { formatKRW } from "@/lib/store";
import { toast } from "@/hooks/use-toast";

type Row = {
  id: string;
  nickname: string;
  tier: "normal" | "vip" | "god" | "empire";
  available_balance: number;
  total_balance: number;
};

const TIERS: Row["tier"][] = ["normal", "vip", "god", "empire"];

export default function ServerUserAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  async function load() {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, nickname, tier")
      .order("created_at", { ascending: false })
      .limit(200);
    if (!profs) return;
    const ids = profs.map((p: any) => p.id);
    const { data: wallets } = await supabase
      .from("wallet_balances")
      .select("user_id, available_balance, total_balance")
      .in("user_id", ids);
    const map = new Map((wallets ?? []).map((w: any) => [w.user_id, w]));
    setRows(profs.map((p: any) => ({
      id: p.id, nickname: p.nickname, tier: p.tier,
      available_balance: map.get(p.id)?.available_balance ?? 0,
      total_balance: map.get(p.id)?.total_balance ?? 0,
    })));
  }

  useEffect(() => { void load(); }, []);

  async function setTier(id: string, tier: Row["tier"]) {
    setBusy(true);
    try {
      await adminSetTier(id, tier);
      toast({ title: `등급 변경: ${tier.toUpperCase()}` });
      await load();
    } catch (e: any) { toast({ title: "실패", description: e.message }); }
    finally { setBusy(false); }
  }

  async function adjust(id: string) {
    const v = prompt("증감 금액 (음수 가능)");
    if (!v) return;
    const delta = parseInt(v.replace(/[^\d-]/g, ""), 10);
    if (!Number.isFinite(delta) || delta === 0) return;
    const reason = prompt("사유") || "admin_adjust";
    setBusy(true);
    try {
      await adminAdjustBalance(id, delta, reason);
      toast({ title: "잔액 조정 완료" });
      await load();
    } catch (e: any) { toast({ title: "실패", description: e.message }); }
    finally { setBusy(false); }
  }

  const filtered = q
    ? rows.filter(r => r.nickname.toLowerCase().includes(q.toLowerCase()) || r.id.startsWith(q))
    : rows;

  return (
    <div className="space-y-3">
      <input
        value={q} onChange={e => setQ(e.target.value)}
        placeholder="닉네임 또는 ID로 검색"
        className="w-full px-4 py-2 rounded-xl glass border border-border text-sm"
      />
      {filtered.length === 0 && <div className="text-center text-xs text-muted-foreground py-8 glass rounded-2xl">회원 없음</div>}
      {filtered.map(u => (
        <div key={u.id} className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <div className="font-bold text-sm truncate">{u.nickname}</div>
              <div className="text-[10px] text-muted-foreground font-mono truncate">{u.id.slice(0, 8)} · {u.tier.toUpperCase()}</div>
            </div>
            <div className="text-right">
              <div className="font-display font-bold text-sm text-gradient-primary">{formatKRW(u.available_balance)}</div>
              <div className="text-[10px] text-muted-foreground">총 {formatKRW(u.total_balance)}</div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-1.5 mt-3">
            {TIERS.map(t => (
              <button key={t} disabled={busy} onClick={() => setTier(u.id, t)}
                className={`py-1.5 rounded-lg text-[10px] font-bold ${u.tier === t ? "bg-gradient-gold text-gold-foreground" : "glass"}`}>
                {t.toUpperCase()}
              </button>
            ))}
          </div>
          <button onClick={() => adjust(u.id)} disabled={busy}
            className="mt-2 w-full py-2 rounded-xl glass border border-border text-xs font-bold">
            잔액 조정
          </button>
        </div>
      ))}
    </div>
  );
}
