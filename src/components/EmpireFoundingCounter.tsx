import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Crown } from "lucide-react";

export default function EmpireFoundingCounter({ compact }: { compact?: boolean }) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data } = await supabase.rpc("get_empire_seats_remaining");
      if (mounted && typeof data === "number") setRemaining(data);
    };
    void load();
    const ch = supabase
      .channel("empire-seats")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "empire_founding_seats" },
        () => void load()
      )
      .subscribe();
    const i = setInterval(load, 30_000);
    return () => {
      mounted = false;
      supabase.removeChannel(ch);
      clearInterval(i);
    };
  }, []);

  if (remaining === null) return null;
  const claimed = 30 - remaining;
  const pct = Math.min(100, (claimed / 30) * 100);

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gold">
        <Crown className="w-3 h-3" />
        Founding 잔여 <span className="tabular-nums">{remaining}</span>/30석
      </span>
    );
  }

  return (
    <div className="rounded-xl p-3 border border-gold/40 bg-gold/5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-gold">
          <Crown className="w-3.5 h-3.5" /> Empire Founding Member
        </div>
        <span className="font-display font-black text-sm tabular-nums">
          <span className="text-gold">{remaining}</span>
          <span className="text-muted-foreground text-xs">/30석</span>
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-gradient-gold transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[9px] text-muted-foreground mt-1.5">
        ※ DB 강제 한정 · 30석 마감 시 다음 시즌 대기
      </p>
    </div>
  );
}
