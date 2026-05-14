/**
 * Withdrawal Queue + Bulk Approve/Reject (Day 2)
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { LoadingCard } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { notify } from "@/lib/notify";
import { Check, X } from "lucide-react";

type Row = {
  id: string;
  user_id: string;
  amount: number;
  method: string;
  status: string;
  created_at: string;
  bank_name?: string | null;
  bank_account?: string | null;
  coin_address?: string | null;
};

export default function WithdrawalQueueBulk() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");

  const load = async () => {
    const { data, error } = await supabase
      .from("withdrawal_requests")
      .select("id,user_id,amount,method,status,created_at,bank_name,bank_account,coin_address")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) return notify.error(error.message);
    setRows((data as any) ?? []);
    setPicked(new Set());
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = (id: string) => {
    const n = new Set(picked);
    n.has(id) ? n.delete(id) : n.add(id);
    setPicked(n);
  };

  const allOn = rows && picked.size === rows.length && rows.length > 0;
  const toggleAll = () => {
    if (!rows) return;
    setPicked(allOn ? new Set() : new Set(rows.map((r) => r.id)));
  };

  const approve = async () => {
    if (picked.size === 0) return;
    if (!confirm(`${picked.size}건 일괄 승인하시겠습니까?`)) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_bulk_approve_withdrawals" as any, { _ids: Array.from(picked) });
    setBusy(false);
    if (error) return notify.error(error.message);
    notify.success(`${data}건 승인 완료`);
    load();
  };

  const reject = async () => {
    if (picked.size === 0) return;
    if (reason.trim().length < 3) return notify.warning("반려 사유를 3자 이상 입력하세요");
    if (!confirm(`${picked.size}건 일괄 반려하시겠습니까?`)) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_bulk_reject_withdrawals" as any, {
      _ids: Array.from(picked),
      _reason: reason.trim(),
    });
    setBusy(false);
    if (error) return notify.error(error.message);
    notify.success(`${data}건 반려 완료`);
    setReason("");
    load();
  };

  if (rows === null) return <LoadingCard />;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display font-black text-xl sm:text-2xl">출금 신청 큐 + Bulk</h1>
        <p className="text-xs text-muted-foreground mt-1">
          대기 중 {rows.length}건 — 다중 선택 후 일괄 승인/반려
        </p>
      </header>

      <div className="glass-strong rounded-xl p-3 border border-border/40 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={toggleAll}>
          {allOn ? "전체 해제" : "전체 선택"}
        </Button>
        <span className="text-xs text-muted-foreground mr-auto">선택 {picked.size}건</span>
        <Input
          placeholder="반려 사유 (3자+)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="max-w-xs h-8"
        />
        <Button size="sm" variant="destructive" onClick={reject} disabled={busy || picked.size === 0}>
          <X className="h-4 w-4 mr-1" /> 일괄 반려
        </Button>
        <Button size="sm" onClick={approve} disabled={busy || picked.size === 0}>
          <Check className="h-4 w-4 mr-1" /> 일괄 승인
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="대기 중인 출금 없음" />
      ) : (
        <div className="glass-strong rounded-xl border border-border/40 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground bg-muted/20">
              <tr>
                <th className="p-2 w-8"></th>
                <th className="text-left p-2">user_id</th>
                <th className="text-right p-2">금액</th>
                <th className="text-left p-2">방법</th>
                <th className="text-left p-2">계좌/주소</th>
                <th className="text-left p-2">신청일</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border/20 hover:bg-muted/10">
                  <td className="p-2">
                    <Checkbox checked={picked.has(r.id)} onCheckedChange={() => toggle(r.id)} />
                  </td>
                  <td className="p-2 font-mono">{r.user_id.slice(0, 8)}…</td>
                  <td className="p-2 text-right tabular-nums font-bold">₩{r.amount.toLocaleString()}</td>
                  <td className="p-2">{r.method}</td>
                  <td className="p-2 font-mono truncate max-w-[200px]">
                    {r.coin_address ?? `${r.bank_name ?? ""} ${r.bank_account ?? ""}`}
                  </td>
                  <td className="p-2">{new Date(r.created_at).toLocaleString("ko-KR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
