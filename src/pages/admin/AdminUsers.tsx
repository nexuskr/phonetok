import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search } from "lucide-react";

export default function AdminUsers() {
  const [q, setQ] = useState("");
  const list = useQuery({
    queryKey: ["admin_users", q],
    queryFn: async () => {
      let query = supabase.from("profiles")
        .select("id,nickname,tier,attendance_streak,referral_code,created_at")
        .order("created_at", { ascending: false }).limit(50);
      if (q.trim()) query = query.ilike("nickname", `%${q.trim()}%`);
      const { data } = await query;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">유저 관리</h1>
      <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border max-w-md">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="닉네임 검색…"
          className="flex-1 bg-transparent outline-none text-sm" />
      </label>

      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr><th className="text-left p-3">닉네임</th><th className="text-left p-3">티어</th><th className="text-left p-3">연속</th><th className="text-left p-3">코드</th><th className="text-left p-3">가입</th></tr>
          </thead>
          <tbody>
            {list.data?.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="p-3 font-semibold">{u.nickname}</td>
                <td className="p-3"><span className="px-2 py-0.5 rounded-md bg-primary/15 text-primary text-xs font-bold">{u.tier}</span></td>
                <td className="p-3">{u.attendance_streak}</td>
                <td className="p-3 font-mono text-xs">{u.referral_code ?? "—"}</td>
                <td className="p-3 text-muted-foreground text-xs">{new Date(u.created_at).toLocaleDateString("ko-KR")}</td>
              </tr>
            )) ?? null}
            {list.isLoading && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">불러오는 중…</td></tr>}
            {list.data?.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">결과 없음</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
