import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shield, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { LoadingList } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { formatKRW } from "@/lib/store";

type LogRow = {
  id: string;
  ts: string;
  delta: number;
  balance_after: number;
  metadata: Record<string, unknown>;
};

interface Props {
  /** Admin sees full balance; user sees aggregate stats only. */
  variant?: "admin" | "user";
  className?: string;
}

export default function InsuranceFundDashboard({ variant = "admin", className = "" }: Props) {
  const [balance, setBalance] = useState<number | null>(null);
  const [stats, setStats] = useState<{ contributed_24h: number; paid_24h: number; events_24h: number } | null>(null);
  const [recent, setRecent] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      const [bRes, sRes, lRes] = await Promise.all([
        variant === "admin"
          ? supabase.from("insurance_fund").select("accumulated").maybeSingle().then((r) => r)
          : Promise.resolve({ data: null }),
        supabase.from("insurance_fund_24h").select("*").maybeSingle().then((r) => r),
        supabase.from("insurance_fund_log").select("*").order("ts", { ascending: false }).limit(20).then((r) => r),
      ]);
      if (!alive) return;
      if (variant === "admin") setBalance((bRes.data as { accumulated: number } | null)?.accumulated ?? 0);
      setStats((sRes.data as typeof stats) ?? { contributed_24h: 0, paid_24h: 0, events_24h: 0 });
      setRecent((lRes.data as LogRow[] | null) ?? []);
      setLoading(false);
    }
    void load();
    const ch = supabase
      .channel("insurance-fund")
      .on("postgres_changes", { event: "*", schema: "public", table: "insurance_fund_log" }, () => void load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "insurance_fund" }, () => void load())
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [variant]);

  if (loading) return <LoadingList rows={4} className={className} />;

  return (
    <section className={`space-y-3 ${className}`}>
      <header className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-primary" />
        <h3 className="font-display font-black text-sm">보험펀드 (Insurance Fund)</h3>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {variant === "admin" && (
          <Stat icon={Shield} label="현재 잔액" value={formatKRW(balance ?? 0)} hot />
        )}
        <Stat icon={TrendingUp} label="24h 유입" value={formatKRW(stats?.contributed_24h ?? 0)} pos />
        <Stat icon={TrendingDown} label="24h 지출" value={formatKRW(stats?.paid_24h ?? 0)} neg />
        <Stat icon={Activity} label="24h 이벤트" value={(stats?.events_24h ?? 0).toLocaleString()} />
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-3 py-2 text-[11px] font-bold border-b border-border/40">최근 펀드 변동</div>
        {recent.length === 0 ? (
          <EmptyState title="이벤트 없음" description="펀드 변동이 발생하면 여기에 표시됩니다." size="sm" variant="muted" />
        ) : (
          <ul className="divide-y divide-border/30">
            {recent.map((r) => (
              <li key={r.id} className="px-3 py-2 flex items-center gap-2 text-[11px]">
                <span className="text-muted-foreground tabular-nums w-28 shrink-0">
                  {new Date(r.ts).toLocaleString("ko-KR", { hour12: false })}
                </span>
                <span className={`font-bold tabular-nums ${r.delta >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                  {r.delta >= 0 ? "+" : ""}{formatKRW(r.delta)}
                </span>
                <span className="ml-auto tabular-nums text-muted-foreground">
                  잔액 {formatKRW(r.balance_after)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Stat({
  icon: Icon, label, value, hot, pos, neg,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hot?: boolean; pos?: boolean; neg?: boolean;
}) {
  const tone = hot ? "text-gold" : pos ? "text-emerald-500" : neg ? "text-destructive" : "text-foreground";
  return (
    <div className="glass rounded-xl p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className={`font-display font-black text-sm tabular-nums mt-0.5 ${tone}`}>{value}</div>
    </div>
  );
}
