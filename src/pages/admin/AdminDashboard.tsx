import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, Wallet, TrendingUp, AlertTriangle } from "lucide-react";

function Kpi({ icon: Icon, label, value, hint }: { icon: React.ElementType; label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl bg-card border border-border p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="text-2xl font-black mt-1">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

export default function AdminDashboard() {
  const kpi = useQuery({
    queryKey: ["admin_kpi"],
    queryFn: async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const iso = today.toISOString();
      const [users, signups, wd, totalBal] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", iso),
        supabase.from("withdrawal_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("phon_balances").select("balance"),
      ]);
      const totalPhon = (totalBal.data ?? []).reduce((sum, r) => sum + Number(r.balance ?? 0), 0);
      return {
        users:   users.count ?? 0,
        signups: signups.count ?? 0,
        wd:      wd.count ?? 0,
        totalPhon,
      };
    },
    refetchInterval: 30_000,
  });

  const k = kpi.data;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black">관리자 대시보드</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={Users} label="총 유저" value={k?.users.toLocaleString() ?? "—"} />
        <Kpi icon={TrendingUp} label="오늘 가입" value={k?.signups.toLocaleString() ?? "—"} hint="자정 기준" />
        <Kpi icon={Wallet} label="총 PHON" value={Math.floor(k?.totalPhon ?? 0).toLocaleString()} />
        <Kpi icon={AlertTriangle} label="대기 출금" value={k?.wd.toLocaleString() ?? "—"} hint="승인 필요" />
      </div>

      <section className="rounded-2xl bg-card border border-border p-5">
        <h2 className="font-bold mb-3">빠른 작업</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <a href="/admin/withdrawals" className="px-3 py-2 rounded-lg bg-primary/10 text-primary font-semibold">출금 큐 보기</a>
          <a href="/admin/users" className="px-3 py-2 rounded-lg bg-muted">유저 검색</a>
          <a href="/admin/balances" className="px-3 py-2 rounded-lg bg-muted">잔고 조정</a>
          <a href="/admin/reports" className="px-3 py-2 rounded-lg bg-muted">신고 큐</a>
        </div>
      </section>
    </div>
  );
}
