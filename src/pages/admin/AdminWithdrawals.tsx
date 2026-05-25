import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function AdminWithdrawals() {
  const list = useQuery({
    queryKey: ["admin_wd"],
    queryFn: async () => {
      const { data } = await supabase
        .from("withdrawal_requests")
        .select("id,user_id,amount,status,bank_name,bank_account,created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    refetchInterval: 15_000,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">출금 승인 큐</h1>
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr><th className="text-left p-3">신청 시각</th><th className="text-right p-3">금액</th><th className="text-left p-3">은행</th><th className="text-left p-3">상태</th></tr>
          </thead>
          <tbody>
            {list.data?.map((w) => (
              <tr key={w.id} className="border-t border-border">
                <td className="p-3 text-xs">{new Date(w.created_at).toLocaleString("ko-KR")}</td>
                <td className="p-3 text-right font-bold">{Number(w.amount).toLocaleString()}</td>
                <td className="p-3 text-xs">{w.bank_name ?? "—"} <span className="text-muted-foreground">{w.bank_account ?? ""}</span></td>
                <td className="p-3"><span className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                  w.status === "pending" ? "bg-yellow-500/15 text-yellow-500" :
                  w.status === "completed" ? "bg-green-500/15 text-green-500" :
                  "bg-muted text-muted-foreground"
                }`}>{w.status}</span></td>
              </tr>
            )) ?? null}
            {list.isLoading && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">불러오는 중…</td></tr>}
            {list.data?.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">대기 중인 출금이 없습니다</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
