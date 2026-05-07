import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "lucide-react";

export default function EmpireDayCountdown() {
  const [date, setDate] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.rpc("get_next_empire_day");
      if (mounted && typeof data === "string") setDate(data);
    })();
  }, []);

  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  const days = Math.max(0, Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  const isToday = days === 0;

  return (
    <div className={`flex items-center gap-1.5 text-[11px] font-bold ${isToday ? "text-gold animate-pulse" : "text-gold/80"}`}>
      <Calendar className="w-3.5 h-3.5" />
      {isToday ? "🔥 오늘 Empire Day · Day 4+ 보유자 +50% 자동" : `다음 Empire Day D-${days} · Day 4 이후 자동 적용`}
    </div>
  );
}
