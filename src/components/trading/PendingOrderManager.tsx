import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";
import { LoadingList } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { FEE_RATE } from "@/lib/trading/types";

interface PendingOrder {
  id: string;
  symbol: string;
  side: "long" | "short";
  kind: "limit" | "stop";
  trigger_price: number;
  leverage: number;
  margin: number;
  status: string;
  created_at: string;
  fill_error: string | null;
}

export function PendingOrderManager({ symbol, currentPrice }: { symbol: string; currentPrice: number }) {
  const [orders, setOrders] = useState<PendingOrder[] | null>(null);
  const [kind, setKind] = useState<"limit" | "stop">("limit");
  const [side, setSide] = useState<"long" | "short">("long");
  const [trigger, setTrigger] = useState("");
  const [leverage, setLeverage] = useState("10");
  const [margin, setMargin] = useState("100");
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const { data, error } = await supabase
      .from("pending_orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (!error) setOrders((data ?? []) as PendingOrder[]);
  };

  useEffect(() => {
    reload();
    const ch = supabase
      .channel("pending_orders_self")
      .on("postgres_changes", { event: "*", schema: "public", table: "pending_orders" }, reload)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const submit = async () => {
    const tp = parseFloat(trigger);
    const lev = parseInt(leverage, 10);
    const mg = parseInt(margin, 10);
    if (!Number.isFinite(tp) || tp <= 0) return notify.error("올바른 트리거 가격을 입력하세요");
    if (!Number.isFinite(lev) || lev < 1 || lev > 100) return notify.error("레버리지는 1~100");
    if (!Number.isFinite(mg) || mg <= 0) return notify.error("마진을 확인하세요");

    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return notify.error("로그인이 필요합니다"); }
    const { error } = await supabase.from("pending_orders").insert({
      user_id: user.id, symbol, side, kind, trigger_price: tp, leverage: lev, margin: mg,
    });
    setBusy(false);
    if (error) return notify.error(error.message);
    notify.success(`${kind.toUpperCase()} ${side.toUpperCase()} 예약 주문 등록`);
    setTrigger("");
    reload();
  };

  const cancel = async (id: string) => {
    const { error } = await supabase.rpc("cancel_pending_order", { p_order_id: id });
    if (error) return notify.error(error.message);
    notify.success("주문 취소");
    reload();
  };

  const expectedFee = (parseInt(margin, 10) || 0) * (parseInt(leverage, 10) || 0) * FEE_RATE;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          예약 주문 (Limit / Stop)
          <Badge variant="secondary" className="text-xs">{symbol}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Tabs value={kind} onValueChange={(v) => setKind(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="limit">Limit</TabsTrigger>
            <TabsTrigger value="stop">Stop</TabsTrigger>
          </TabsList>
          <TabsContent value={kind} className="pt-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Button variant={side === "long" ? "default" : "outline"} size="sm" onClick={() => setSide("long")}>Long</Button>
              <Button variant={side === "short" ? "default" : "outline"} size="sm" onClick={() => setSide("short")}>Short</Button>
            </div>
            <div>
              <Label className="text-xs">트리거 가격 (현재 {currentPrice.toLocaleString()})</Label>
              <Input type="number" step="any" value={trigger} onChange={(e) => setTrigger(e.target.value)} placeholder="예: 65000" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">레버리지</Label>
                <Input type="number" value={leverage} onChange={(e) => setLeverage(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">마진 (USDT)</Label>
                <Input type="number" value={margin} onChange={(e) => setMargin(e.target.value)} />
              </div>
            </div>
            <div className="text-xs text-muted-foreground flex justify-between">
              <span>예상 Fee (0.1%)</span>
              <span>{expectedFee.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT</span>
            </div>
            <Button onClick={submit} disabled={busy} className="w-full">
              {busy ? "등록 중…" : `${kind.toUpperCase()} ${side.toUpperCase()} 예약`}
            </Button>
          </TabsContent>
        </Tabs>

        <div className="pt-2 border-t">
          <div className="text-xs font-medium mb-2">내 예약 주문</div>
          {orders === null ? (
            <LoadingList rows={3} />
          ) : orders.length === 0 ? (
            <EmptyState title="예약 주문 없음" description="Limit/Stop 주문이 트리거 가격에 도달하면 자동 체결됩니다." />
          ) : (
            <ul className="space-y-1.5">
              {orders.map((o) => (
                <li key={o.id} className="flex items-center justify-between text-xs rounded border border-border px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{o.kind.toUpperCase()}</Badge>
                    <span className={o.side === "long" ? "text-emerald-500" : "text-red-500"}>{o.side.toUpperCase()}</span>
                    <span>{o.symbol}</span>
                    <span className="text-muted-foreground">@ {Number(o.trigger_price).toLocaleString()}</span>
                    <span className="text-muted-foreground">x{o.leverage}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={o.status === "open" ? "default" : "secondary"} className="text-[10px]">{o.status}</Badge>
                    {o.status === "open" && (
                      <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => cancel(o.id)}>취소</Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
