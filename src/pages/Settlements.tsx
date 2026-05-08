import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import HubTabs from "@/components/HubTabs";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { supabase } from "@/integrations/supabase/client";
import { formatKRW } from "@/lib/store";
import { Receipt, Clock, CheckCircle2, XCircle, Crown, TrendingUp, ChevronRight, Calendar } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Purchase = {
  id: string;
  package_id: string;
  package_name: string;
  amount: number;
  daily_return: number;
  duration_days: number;
  total_return: number;
  settled_count: number;
  total_settled: number;
  next_settle_at: string | null;
  status: "pending" | "active" | "completed" | "rejected" | string;
  created_at: string;
  approved_at: string | null;
  completed_at: string | null;
  rejected_reason: string | null;
  is_empire_founding_member: boolean;
  founding_seat_no: number | null;
  receipt_url: string | null;
};

type Tx = {
  id: string;
  kind: string;
  direction: string;
  amount: number;
  created_at: string;
  ref_id: string | null;
  metadata: any;
};

const STATUS_META: Record<string, { label: string; tone: string; icon: any }> = {
  pending: { label: "승인 대기", tone: "text-gold bg-gold/15 border-gold/30", icon: Clock },
  active: { label: "정산 중", tone: "text-secondary bg-secondary/15 border-secondary/30", icon: TrendingUp },
  completed: { label: "정산 완료", tone: "text-muted-foreground bg-muted/30 border-muted", icon: CheckCircle2 },
  rejected: { label: "거절됨", tone: "text-destructive bg-destructive/15 border-destructive/30", icon: XCircle },
  failed: { label: "처리 실패", tone: "text-destructive bg-destructive/15 border-destructive/30", icon: XCircle },
};

export function statusBadge(status: string) {
  return STATUS_META[status] ?? STATUS_META.pending;
}

export default function Settlements() {
  const user = useRequireAuth();
  const [rows, setRows] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Purchase | null>(null);
  const [detailTx, setDetailTx] = useState<Tx[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    async function load() {
      const { data } = await supabase
        .from("package_purchases")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (mounted) {
        setRows((data ?? []) as Purchase[]);
        setLoading(false);
      }
    }
    void load();
    const ch = supabase
      .channel("user:settlements")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "package_purchases", filter: `user_id=eq.${user.id}` },
        () => void load()
      )
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [user?.id]);

  async function openDetail(p: Purchase) {
    setDetail(p);
    setDetailTx([]);
    setDetailLoading(true);
    const { data } = await supabase
      .from("transactions")
      .select("id,kind,direction,amount,created_at,ref_id,metadata")
      .eq("user_id", user!.id)
      .eq("ref_id", p.id)
      .order("created_at", { ascending: false })
      .limit(200);
    setDetailTx((data ?? []) as Tx[]);
    setDetailLoading(false);
  }

  if (!user) return null;

  const totalEarned = rows.reduce((s, r) => s + (r.total_settled ?? 0), 0);
  const activeCount = rows.filter((r) => r.status === "active").length;

  return (
    <Layout>
      <HubTabs hub="treasury" />
      <div className="container pt-2 pb-10 space-y-4 animate-liquid-in">
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-strong rounded-2xl p-4 neon-border">
            <div className="text-[10px] text-muted-foreground">누적 정산 수령</div>
            <div className="font-display font-black text-lg text-gradient-gold mt-1">{formatKRW(totalEarned)}</div>
          </div>
          <div className="glass-strong rounded-2xl p-4 neon-border">
            <div className="text-[10px] text-muted-foreground">정산 중 패키지</div>
            <div className="font-display font-black text-lg mt-1">{activeCount}개</div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4">
          <Receipt className="w-4 h-4 text-gold" />
          <h2 className="font-display font-black text-sm">패키지 정산 내역</h2>
        </div>

        {loading && <div className="glass rounded-2xl p-10 text-center text-xs text-muted-foreground">불러오는 중…</div>}
        {!loading && rows.length === 0 && (
          <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
            아직 구매한 패키지가 없습니다
          </div>
        )}

        <div className="space-y-3">
          {rows.map((r) => {
            const meta = statusBadge(r.status);
            const Icon = meta.icon;
            const pct = r.duration_days > 0 ? Math.min(100, (r.settled_count / r.duration_days) * 100) : 0;
            return (
              <button
                key={r.id}
                onClick={() => openDetail(r)}
                className="w-full text-left glass-strong rounded-2xl p-4 neon-border hover:bg-accent/5 press transition"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-display font-black text-sm truncate">{r.package_name}</span>
                      {r.is_empire_founding_member && (
                        <span className="text-[10px] text-gold flex items-center gap-0.5">
                          <Crown className="w-3 h-3" /> #{r.founding_seat_no}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString("ko-KR")}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-1 rounded-full font-bold border flex items-center gap-1 ${meta.tone}`}>
                      <Icon className="w-3 h-3" /> {meta.label}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3 text-[11px]">
                  <Cell label="투자" value={formatKRW(r.amount)} />
                  <Cell label="일정산" value={formatKRW(r.daily_return)} />
                  <Cell label="누적" value={formatKRW(r.total_settled)} />
                </div>

                <div className="mt-3">
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>{r.settled_count} / {r.duration_days}일 정산</span>
                    <span>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                    <div className="h-full bg-gradient-imperial transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              {detail && (
                <>
                  <span>{detail.package_name}</span>
                  {(() => {
                    const m = statusBadge(detail.status);
                    const I = m.icon;
                    return (
                      <span className={`text-[10px] px-2 py-1 rounded-full font-bold border flex items-center gap-1 ${m.tone}`}>
                        <I className="w-3 h-3" /> {m.label}
                      </span>
                    );
                  })()}
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <DetailBody p={detail} txs={detailTx} loading={detailLoading} />
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function DetailBody({ p, txs, loading }: { p: Purchase; txs: Tx[]; loading: boolean }) {
  const pct = p.duration_days > 0 ? Math.min(100, (p.settled_count / p.duration_days) * 100) : 0;
  const settleTx = useMemo(() => txs.filter((t) => t.kind === "package_settle" || (t.metadata?.event === "settle")), [txs]);
  const totalSettled = settleTx.reduce((s, t) => s + (t.amount ?? 0), 0);

  return (
    <div className="space-y-4 text-xs">
      <div className="grid grid-cols-2 gap-2">
        <Cell label="투자 금액" value={formatKRW(p.amount)} />
        <Cell label="총 수익" value={formatKRW(p.total_return)} />
        <Cell label="일정산" value={formatKRW(p.daily_return)} />
        <Cell label="기간" value={`${p.duration_days}일`} />
        <Cell label="누적 정산" value={formatKRW(p.total_settled)} />
        <Cell label="진행" value={`${p.settled_count}/${p.duration_days} (${pct.toFixed(0)}%)`} />
      </div>

      {p.status === "rejected" && p.rejected_reason && (
        <div className="glass rounded-lg p-2 text-destructive text-[11px]">사유: {p.rejected_reason}</div>
      )}
      {p.receipt_url && (
        <a href={p.receipt_url} target="_blank" rel="noreferrer" className="text-[11px] text-primary underline block">
          영수증 보기
        </a>
      )}

      <div>
        <div className="font-bold flex items-center gap-1 mb-2">
          <Calendar className="w-3.5 h-3.5 text-gold" /> 처리 타임라인
        </div>
        <ul className="space-y-1.5">
          <TimelineItem when={p.created_at} label="신청 접수" tone="muted" />
          {p.approved_at && <TimelineItem when={p.approved_at} label="관리자 승인 · 정산 시작" tone="ok" />}
          {p.next_settle_at && p.status === "active" && (
            <TimelineItem when={p.next_settle_at} label="다음 자동 정산 예정" tone="info" />
          )}
          {p.completed_at && <TimelineItem when={p.completed_at} label="정산 완료" tone="ok" />}
          {p.status === "rejected" && <TimelineItem when={p.created_at} label="거절됨" tone="fail" />}
        </ul>
      </div>

      <div>
        <div className="font-bold flex items-center justify-between mb-2">
          <span>관련 거래 {txs.length > 0 && `(${txs.length})`}</span>
          {settleTx.length > 0 && <span className="text-[10px] text-muted-foreground font-normal">정산 합계 {formatKRW(totalSettled)}</span>}
        </div>
        {loading && <div className="glass rounded-lg p-3 text-center text-[11px] text-muted-foreground">불러오는 중…</div>}
        {!loading && txs.length === 0 && (
          <div className="glass rounded-lg p-3 text-center text-[11px] text-muted-foreground">관련 거래 없음</div>
        )}
        <ul className="space-y-1 max-h-60 overflow-y-auto">
          {txs.map((t) => (
            <li key={t.id} className="glass rounded-lg p-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] font-bold truncate">{t.kind}</div>
                <div className="text-[9px] text-muted-foreground">{new Date(t.created_at).toLocaleString("ko-KR")}</div>
              </div>
              <div className={`text-[11px] font-bold ${t.direction === "credit" ? "text-secondary" : "text-destructive"}`}>
                {t.direction === "credit" ? "+" : "-"}{formatKRW(t.amount)}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function TimelineItem({ when, label, tone }: { when: string; label: string; tone: "ok" | "fail" | "info" | "muted" }) {
  const dot =
    tone === "ok" ? "bg-secondary" : tone === "fail" ? "bg-destructive" : tone === "info" ? "bg-gold" : "bg-muted-foreground";
  return (
    <li className="flex items-start gap-2 text-[11px]">
      <span className={`w-2 h-2 rounded-full mt-1.5 ${dot}`} />
      <div className="flex-1 flex justify-between gap-2">
        <span>{label}</span>
        <span className="text-muted-foreground text-[10px]">{new Date(when).toLocaleString("ko-KR")}</span>
      </div>
    </li>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-lg p-2 text-center">
      <div className="text-[9px] text-muted-foreground">{label}</div>
      <div className="font-bold mt-0.5 text-[11px]">{value}</div>
    </div>
  );
}
