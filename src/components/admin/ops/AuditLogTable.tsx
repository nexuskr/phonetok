import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LoadingList } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { notify } from "@/lib/notify";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollText, RefreshCw } from "lucide-react";

type Row = {
  id: string;
  admin_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: any;
  created_at: string;
};

export default function AuditLogTable() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [adminFilter, setAdminFilter] = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_get_audit_log", {
      _action: actionFilter || null,
      _admin_id: adminFilter || null,
      _limit: 200,
    });
    if (error) notify.error(error.message);
    setRows((data as Row[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display font-black text-xl sm:text-2xl flex items-center gap-2">
          <ScrollText className="w-5 h-5" /> 📜 감사 로그
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          모든 어드민 행동(crown trigger · 출금 승인 · 게임컨피그 변경 등)이 기록됩니다.
        </p>
      </header>

      <div className="glass-strong rounded-2xl p-4 border border-border/40 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[180px]">
          <label className="text-xs text-muted-foreground">액션 필터</label>
          <Input
            placeholder="예: ab.create, broadcast.send"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-muted-foreground">관리자 ID</label>
          <Input
            placeholder="UUID (선택)"
            value={adminFilter}
            onChange={(e) => setAdminFilter(e.target.value)}
          />
        </div>
        <Button onClick={load} variant="default" className="gap-2">
          <RefreshCw className="w-4 h-4" /> 새로고침
        </Button>
      </div>

      {loading ? (
        <LoadingList rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState title="기록 없음" description="조건에 맞는 감사 로그가 없습니다." icon={<ScrollText className="w-6 h-6" />} />
      ) : (
        <div className="glass-strong rounded-2xl border border-border/40 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">시각</th>
                <th className="text-left p-3">관리자</th>
                <th className="text-left p-3">액션</th>
                <th className="text-left p-3">대상</th>
                <th className="text-left p-3">메타</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border/30 hover:bg-muted/20">
                  <td className="p-3 whitespace-nowrap text-xs">
                    {new Date(r.created_at).toLocaleString("ko-KR")}
                  </td>
                  <td className="p-3 font-mono text-xs">{r.admin_id.slice(0, 8)}…</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-bold">
                      {r.action}
                    </span>
                  </td>
                  <td className="p-3 text-xs">
                    {r.target_type ? (
                      <>
                        <span className="text-muted-foreground">{r.target_type}</span>
                        {r.target_id && <span className="font-mono"> · {r.target_id.slice(0, 8)}…</span>}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-3 text-xs font-mono max-w-[280px] truncate">
                    {r.metadata && Object.keys(r.metadata).length > 0
                      ? JSON.stringify(r.metadata)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
