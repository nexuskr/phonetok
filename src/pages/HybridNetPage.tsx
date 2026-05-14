/**
 * /trade/net — Hybrid Net Cross Settlement (Phase B).
 * 심볼별 자동 헤지·정산 뷰. Net View ↔ Raw View 토글.
 * 백엔드 RPC: get_my_hybrid_net (auth.uid() guarded).
 * 정책: 기존 live_positions append-only 구조 0% 변경. UI/정산 레이어만.
 */
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Layers, List, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingList } from "@/components/ui/loading-state";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";

type NetRow = {
  symbol: string;
  long_count: number;
  short_count: number;
  long_size: number;
  short_size: number;
  net_size: number;
  net_side: "long" | "short" | "flat";
  total_margin: number;
  weighted_entry: number | null;
};

type RawRow = {
  id: string;
  symbol: string;
  side: "long" | "short";
  leverage: number;
  margin: number;
  size: number;
  entry: number;
  opened_at: string;
};

export default function HybridNetPage() {
  const navigate = useNavigate();
  const [net, setNet] = useState<NetRow[]>([]);
  const [raw, setRaw] = useState<RawRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      const [netRes, rawRes] = await Promise.all([
        (supabase.rpc as any)("get_my_hybrid_net"),
        supabase.from("live_positions")
          .select("id,symbol,side,leverage,margin,size,entry,opened_at")
          .eq("user_id", session.user.id)
          .eq("status", "open")
          .order("opened_at", { ascending: false })
          .limit(200),
      ]);
      if (netRes.error) throw netRes.error;
      if (rawRes.error) throw rawRes.error;
      setNet((netRes.data ?? []) as NetRow[]);
      setRaw((rawRes.data ?? []) as RawRow[]);
    } catch (e: any) {
      notify.error("불러오기 실패", { description: e?.message ?? String(e) });
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-background/80 border-b border-border/40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1">
            <ArrowLeft className="h-4 w-4" /> 뒤로
          </Button>
          <div className="flex-1">
            <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Phonara · Hybrid Net</div>
            <h1 className="text-xl font-black tracking-tight">심볼별 순포지션 정산</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-4">
        <Card className="p-4 mb-4 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <div className="text-xs text-muted-foreground">
            동일 심볼에 long/short 포지션이 동시에 있을 때, 자동으로 헤지된 후의 <strong className="text-foreground">순(net) 포지션</strong>을 보여줍니다.
            기존 포지션은 그대로 유지되며 (append-only), 표시·정산 레이어에서만 합산합니다.
          </div>
        </Card>

        <Tabs defaultValue="net">
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="net" className="gap-2"><Layers className="h-4 w-4" /> Net View</TabsTrigger>
            <TabsTrigger value="raw" className="gap-2"><List className="h-4 w-4" /> Raw View</TabsTrigger>
          </TabsList>

          {/* NET */}
          <TabsContent value="net" className="space-y-2">
            {loading ? (
              <LoadingList lines={4} />
            ) : net.length === 0 ? (
              <EmptyState
                icon={<Layers className="h-8 w-8 text-muted-foreground" />}
                title="활성 포지션 없음"
                description="포지션을 열면 자동으로 심볼별로 합산되어 표시됩니다."
                action={<Button onClick={() => navigate("/arena")}>거래 아레나로</Button>}
              />
            ) : (
              net.map((r) => {
                const pos = r.net_side === "long";
                const flat = r.net_side === "flat";
                return (
                  <Card key={r.symbol} className={`p-4 border ${flat ? "border-border/40" : pos ? "border-emerald-500/30" : "border-rose-500/30"}`}>
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${flat ? "bg-muted text-muted-foreground" : pos ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>
                        {flat ? <Layers className="h-4 w-4" /> : pos ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold tracking-tight">{r.symbol}</div>
                        <div className="text-[11px] text-muted-foreground">
                          long {r.long_count} · short {r.short_count} · 마진 {Number(r.total_margin).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-mono tabular-nums font-bold ${flat ? "text-muted-foreground" : pos ? "text-emerald-300" : "text-rose-300"}`}>
                          {flat ? "FLAT" : `${pos ? "+" : ""}${Number(r.net_size).toFixed(4)}`}
                        </div>
                        <div className="text-[10px] text-muted-foreground tabular-nums">
                          평단 {r.weighted_entry ? Number(r.weighted_entry).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* RAW */}
          <TabsContent value="raw" className="space-y-2">
            {loading ? (
              <LoadingList lines={4} />
            ) : raw.length === 0 ? (
              <EmptyState
                icon={<List className="h-8 w-8 text-muted-foreground" />}
                title="활성 포지션 없음"
                description="실제 체결된 포지션 1건마다 한 줄씩 표시됩니다."
              />
            ) : (
              raw.map((r) => {
                const pos = r.side === "long";
                return (
                  <Card key={r.id} className={`p-3 border ${pos ? "border-emerald-500/20" : "border-rose-500/20"}`}>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black ${pos ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>
                        {pos ? "LONG" : "SHORT"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold">{r.symbol} <span className="text-[10px] text-muted-foreground font-mono">×{r.leverage}</span></div>
                        <div className="text-[10px] text-muted-foreground tabular-nums">
                          size {Number(r.size).toFixed(4)} · entry {Number(r.entry).toLocaleString(undefined, { maximumFractionDigits: 2 })} · {new Date(r.opened_at).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right text-xs font-mono tabular-nums text-muted-foreground">
                        margin {Number(r.margin).toLocaleString()}
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
