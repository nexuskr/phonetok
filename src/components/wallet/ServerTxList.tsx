import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Clock, ArrowUpRight, ArrowDownLeft, Coins, Trophy, Banknote, Inbox } from "lucide-react";
import { LoadingList } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";

type Tx = {
  id: string;
  kind: string;
  direction: "credit" | "debit";
  amount: number;
  balance_after: number;
  available_after: number;
  ref_id: string | null;
  mission_id: string | null;
  metadata: any;
  created_at: string;
};

const KIND_LABEL: Record<string, { label: string; icon: any; color: string }> = {
  mission_win: { label: "미션 보상", icon: Trophy, color: "text-secondary" },
  withdrawal_lock: { label: "출금 신청", icon: ArrowUpRight, color: "text-primary" },
  withdrawal_complete: { label: "출금 완료", icon: Banknote, color: "text-secondary" },
  withdrawal_release: { label: "출금 환불", icon: ArrowDownLeft, color: "text-gold" },
  profit_share: { label: "수익 공유", icon: Coins, color: "text-gold" },
};

function formatKRW(n: number) {
  return new Intl.NumberFormat("ko-KR").format(n) + "원";
}

export default function ServerTxList() {
  const [list, setList] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setLoading(false); return; }
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (mounted) {
        setList((data ?? []) as Tx[]);
        setLoading(false);
      }
    })();

    const ch = supabase
      .channel("user:tx")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions" }, (payload) => {
        setList((prev) => [payload.new as Tx, ...prev].slice(0, 50));
      })
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, []);

  if (loading) return <LoadingList rows={4} rowHeight="md" />;
  if (list.length === 0) return (
    <EmptyState
      icon={<Inbox className="w-5 h-5" />}
      title="서버 거래내역이 없습니다"
      description="입출금/보상 등의 활동이 기록되면 이곳에 표시됩니다."
      variant="muted"
    />
  );

  return (
    <div className="space-y-2">
      {list.map((t) => {
        const meta = KIND_LABEL[t.kind] ?? { label: t.kind, icon: Clock, color: "text-muted-foreground" };
        const Icon = meta.icon;
        const isCredit = t.direction === "credit";
        return (
          <div key={t.id} className="glass rounded-2xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-9 h-9 rounded-xl glass flex items-center justify-center ${meta.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold truncate">{meta.label}</div>
                <div className="text-[10px] text-muted-foreground">{new Date(t.created_at).toLocaleString("ko-KR")}</div>
                {t.ref_id && <div className="text-[10px] text-secondary font-mono">{t.ref_id}</div>}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className={`font-display font-bold text-sm ${isCredit ? "text-secondary" : "text-primary"}`}>
                {isCredit ? "+" : "-"}{formatKRW(Number(t.amount))}
              </div>
              <div className="text-[10px] text-muted-foreground">잔고 {formatKRW(Number(t.available_after))}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
