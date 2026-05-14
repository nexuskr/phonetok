import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LoadingList } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { notify } from "@/lib/notify";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Megaphone, Plus } from "lucide-react";

const KINDS = ["influencer", "telegram_blast", "push", "email", "other"] as const;
const STATUSES = ["planned", "running", "paused", "done", "canceled"] as const;

type Campaign = {
  id: string;
  kind: string;
  name: string;
  budget_krw: number;
  status: string;
  created_at: string;
};

export default function MarketingTools() {
  const [list, setList] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<(typeof KINDS)[number]>("influencer");
  const [name, setName] = useState("");
  const [budget, setBudget] = useState<number>(0);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_campaigns", { _limit: 100 });
    if (error) notify.error(error.message);
    setList((data as Campaign[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!name.trim()) {
      notify.error("캠페인 이름을 입력하세요.");
      return;
    }
    setCreating(true);
    const { error } = await supabase.rpc("admin_create_campaign", {
      _kind: kind,
      _name: name,
      _payload: {},
      _budget_krw: budget,
    });
    setCreating(false);
    if (error) return notify.error(error.message);
    notify.success("캠페인이 생성되었습니다.");
    setName("");
    setBudget(0);
    load();
  }

  async function setStatus(id: string, status: string) {
    const { error } = await supabase.rpc("admin_update_campaign_status", {
      _id: id,
      _status: status,
    });
    if (error) return notify.error(error.message);
    notify.success(`상태 → ${status}`);
    load();
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display font-black text-xl sm:text-2xl flex items-center gap-2">
          <Megaphone className="w-5 h-5" /> 📢 마케팅 도구
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          인플루언서 협찬 · Telegram Blast · Push 캠페인을 관리합니다.
        </p>
      </header>

      <div className="glass-strong rounded-2xl p-5 border border-border/40 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">유형</label>
            <select
              className="w-full h-10 rounded-md border border-border/40 bg-background px-3 text-sm"
              value={kind}
              onChange={(e) => setKind(e.target.value as any)}
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground">캠페인 이름</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 5월 인플루언서 시드" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">예산 (KRW)</label>
            <Input
              type="number"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value || 0))}
            />
          </div>
        </div>
        <Button onClick={create} disabled={creating} className="gap-2">
          <Plus className="w-4 h-4" /> {creating ? "생성 중…" : "캠페인 생성"}
        </Button>
      </div>

      {loading ? (
        <LoadingList rows={4} />
      ) : list.length === 0 ? (
        <EmptyState title="캠페인 없음" description="아직 생성된 캠페인이 없습니다." icon={<Megaphone className="w-6 h-6" />} />
      ) : (
        <div className="glass-strong rounded-2xl border border-border/40 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">시작</th>
                <th className="text-left p-3">유형</th>
                <th className="text-left p-3">이름</th>
                <th className="text-right p-3">예산 (₩)</th>
                <th className="text-left p-3">상태</th>
                <th className="text-right p-3">조작</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className="border-t border-border/30">
                  <td className="p-3 text-xs">{new Date(c.created_at).toLocaleDateString("ko-KR")}</td>
                  <td className="p-3 text-xs uppercase">{c.kind}</td>
                  <td className="p-3 font-medium">{c.name}</td>
                  <td className="p-3 text-right font-mono">{c.budget_krw.toLocaleString()}</td>
                  <td className="p-3 text-xs">
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">
                      {c.status}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <select
                      className="h-8 rounded border border-border/40 bg-background px-2 text-xs"
                      value={c.status}
                      onChange={(e) => setStatus(c.id, e.target.value)}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
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
