import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function AdminBalances() {
  const list = useQuery({
    queryKey: ["admin_balances"],
    queryFn: async () => {
      const { data } = await supabase
        .from("phon_balances")
        .select("user_id,balance,updated_at")
        .order("balance", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">잔고 조회</h1>
      <p className="text-sm text-muted-foreground">상위 50명. 잔고 조정은 별도 RPC로만 진행하세요 (감사 로그 자동 기록).</p>
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr><th className="text-left p-3">User ID</th><th className="text-right p-3">잔액 PHON</th><th className="text-left p-3">업데이트</th></tr>
          </thead>
          <tbody>
            {list.data?.map((b) => (
              <tr key={b.user_id} className="border-t border-border">
                <td className="p-3 font-mono text-xs truncate max-w-[200px]">{b.user_id}</td>
                <td className="p-3 text-right font-bold text-primary">{Math.floor(Number(b.balance)).toLocaleString()}</td>
                <td className="p-3 text-muted-foreground text-xs">{new Date(b.updated_at).toLocaleString("ko-KR")}</td>
              </tr>
            )) ?? null}
            {list.isLoading && <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">불러오는 중…</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
