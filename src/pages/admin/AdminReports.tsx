import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function AdminReports() {
  const list = useQuery({
    queryKey: ["admin_anomaly"],
    queryFn: async () => {
      const { data } = await supabase
        .from("anomaly_events")
        .select("id,rule,severity,user_id,created_at,payload")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">신고 / 이상감지</h1>
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr><th className="text-left p-3">시각</th><th className="text-left p-3">규칙</th><th className="text-left p-3">심각도</th><th className="text-left p-3">유저</th></tr>
          </thead>
          <tbody>
            {list.data?.map((e) => (
              <tr key={e.id} className="border-t border-border">
                <td className="p-3 text-xs">{new Date(e.created_at).toLocaleString("ko-KR")}</td>
                <td className="p-3 font-semibold">{e.rule}</td>
                <td className="p-3"><span className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                  e.severity === "critical" ? "bg-destructive/15 text-destructive" :
                  e.severity === "warning" ? "bg-yellow-500/15 text-yellow-500" :
                  "bg-muted text-muted-foreground"
                }`}>{e.severity}</span></td>
                <td className="p-3 font-mono text-xs truncate max-w-[200px]">{e.user_id ?? "—"}</td>
              </tr>
            )) ?? null}
            {list.isLoading && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">불러오는 중…</td></tr>}
            {list.data?.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">이상 신호 없음 ✓</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
