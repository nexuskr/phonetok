import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LoadingList } from "@/components/ui/loading-state";
import { notify } from "@/lib/notify";
import { Sparkles } from "lucide-react";

type Stat = {
  days: number;
  sim_active_users: number;
  real_depositors: number;
  converted: number;
  total_deposit_krw: number;
};

const PERIODS = [7, 14, 30, 90];

export default function SimRealConversion() {
  const [days, setDays] = useState(30);
  const [stat, setStat] = useState<Stat | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .rpc("admin_get_sim_real_conversion", { _days: days })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) notify.error(error.message);
        setStat((data as Stat | null) ?? null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  const rate =
    stat && stat.sim_active_users > 0
      ? ((stat.converted / stat.sim_active_users) * 100).toFixed(2)
      : "0.00";

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display font-black text-xl sm:text-2xl flex items-center gap-2">
          <Sparkles className="w-5 h-5" /> 💱 SIM → Real 전환
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          PHON 시뮬레이션 활성 유저가 실제 입금으로 얼마나 전환되는지 추적합니다.
        </p>
      </header>

      <div className="flex gap-2">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setDays(p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
              days === p
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/20 border-border/40 text-muted-foreground"
            }`}
          >
            {p}일
          </button>
        ))}
      </div>

      {loading || !stat ? (
        <LoadingList rows={3} />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card label="SIM 활성 유저" value={stat.sim_active_users.toLocaleString()} />
          <Card label="실제 입금자" value={stat.real_depositors.toLocaleString()} />
          <Card label="SIM→Real 전환" value={stat.converted.toLocaleString()} accent />
          <Card label="전환율" value={`${rate}%`} accent />
          <Card
            label={`${days}일 총 입금액`}
            value={`₩ ${stat.total_deposit_krw.toLocaleString()}`}
            wide
          />
        </div>
      )}
    </div>
  );
}

function Card({
  label,
  value,
  accent,
  wide,
}: {
  label: string;
  value: string;
  accent?: boolean;
  wide?: boolean;
}) {
  return (
    <div
      className={`glass-strong rounded-2xl p-4 border border-border/40 ${
        wide ? "sm:col-span-4" : ""
      }`}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`mt-1 font-display font-black text-xl sm:text-2xl ${
          accent ? "text-primary" : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
