import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy } from "lucide-react";
import { formatKRW } from "@/lib/store";

type Row = {
  id: string;
  package_name: string;
  daily_return: number;
  harvest_streak: number;
  seven_day_bonus_paid: boolean;
};

export default function SevenDayChallengeCard() {
  const [row, setRow] = useState<Row | null>(null);

  useEffect(() => {
    const mounted = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("package_purchases")
        .select("id,package_name,daily_return,harvest_streak,seven_day_bonus_paid")
        .eq("user_id", user.id)
        .eq("status", "active")
        .eq("seven_day_bonus_paid", false)
        .order("created_at", { ascending: false })
        .limit(1);
      if (mounted) setRow((data?.[0] as Row) ?? null);
    })();
  }, []);

  if (!row) return null;
  const streak = Math.min(7, row.harvest_streak);
  const pct = (streak / 7) * 100;

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-gold" />
          <span className="text-xs font-bold">7일 연속 수확 챌린지</span>
        </div>
        <span className="text-[11px] font-display font-black tabular-nums">
          {streak}<span className="text-muted-foreground">/7일</span>
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
        <div className="h-full bg-gradient-gold transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-muted-foreground">
        달성 시 <span className="text-gold font-bold">{formatKRW(row.daily_return)}</span> 자동 추가 (1회 한정)
      </p>
    </div>
  );
}
