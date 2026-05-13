import { useEffect, useState } from "react";
import { useNowTick } from "@/hooks/use-now-tick";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatKRW } from "@/lib/store";
import { refreshWallet } from "@/lib/missions-rpc";
import { toast } from "@/hooks/use-toast";
import { Bot, Sparkles, ChevronRight, Zap } from "lucide-react";

type Machine = {
  id: string;
  package_id: string;
  package_name: string;
  daily_return: number;
  duration_days: number;
  settled_count: number;
  last_harvest_date: string | null;
  harvest_streak: number;
  status: string;
};

function isHarvestableToday(m: Machine) {
  if (!m.last_harvest_date) return true;
  const today = new Date().toISOString().slice(0, 10);
  return m.last_harvest_date < today;
}

function nextHarvestCountdown(): string {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const ms = tomorrow.getTime() - now.getTime();
  const h = Math.floor(ms / 3.6e6);
  const m = Math.floor((ms % 3.6e6) / 6e4);
  const s = Math.floor((ms % 6e4) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function MachineDashboardCard() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [harvesting, setHarvesting] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from("package_purchases")
      .select("id,package_id,package_name,daily_return,duration_days,settled_count,last_harvest_date,harvest_streak,status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false });
    setMachines((data ?? []) as Machine[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);
  const _machineTick = useNowTick(2000);
  useEffect(() => { setTick((t) => t + 1); }, [_machineTick]);

  const harvest = async (m: Machine) => {
    setHarvesting(m.id);
    const { data, error } = await supabase.rpc("harvest_machine", { _purchase_id: m.id });
    setHarvesting(null);
    if (error) {
      toast({ title: "수확 실패", description: error.message, variant: "destructive" });
      return;
    }
    const result = data as { amount: number; streak: number; completed: boolean };
    toast({
      title: `🤖 +${formatKRW(result.amount)} 수확 완료!`,
      description: result.completed ? "🎉 머신 만기 완료!" : `${result.streak}일 연속 수확 중`,
    });
    void refreshWallet();
    void load();
  };

  if (loading) return null;

  if (machines.length === 0) {
    return (
      <Link to="/packages" className="block group">
        <div className="relative lift">
          <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-gold via-primary to-secondary opacity-60 blur group-hover:opacity-100 transition" />
          <div className="relative glass-strong rounded-2xl p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gold/30 to-primary/30 flex items-center justify-center">
              <Bot className="w-6 h-6 text-gold" />
            </div>
            <div className="flex-1">
              <div className="font-display font-black text-sm">🤖 AI Money Machine 가동하기</div>
              <p className="text-[11px] text-muted-foreground">머신 ON → 매일 수확 버튼 1번 → 끝</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </Link>
    );
  }

  return (
    <div className="space-y-3">
      {machines.map(m => {
        const ready = isHarvestableToday(m);
        const daysLeft = Math.max(0, m.duration_days - m.settled_count);
        return (
          <div key={m.id} className="relative lift">
            <div className={`absolute -inset-0.5 rounded-2xl bg-gradient-to-r ${ready ? "from-gold via-primary to-gold animate-pulse" : "from-muted to-muted"} opacity-60 blur`} />
            <div className="relative glass-strong rounded-2xl p-4 overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${ready ? "bg-gradient-to-br from-gold/40 to-primary/40" : "bg-muted/30"}`}>
                    <Bot className={`w-5 h-5 ${ready ? "text-gold" : "text-muted-foreground"}`} />
                  </div>
                  <div>
                    <div className="font-display font-black text-sm flex items-center gap-1">
                      {m.package_name}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${ready ? "bg-gold/20 text-gold" : "bg-muted/30 text-muted-foreground"}`}>
                        {ready ? "🟢 ON · 수확 가능" : "✓ 오늘 수확 완료"}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {m.harvest_streak}일째 가동 중 · 잔여 {daysLeft}일
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-center mb-3">
                <p className="text-[10px] text-muted-foreground">{ready ? "오늘 수확 가능 금액" : "내일 수확 가능"}</p>
                <p className="font-display font-black text-3xl text-gradient-gold">
                  {formatKRW(m.daily_return)}
                </p>
              </div>

              {ready ? (
                <button
                  onClick={() => harvest(m)}
                  disabled={harvesting === m.id}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-gold via-primary to-gold font-display font-black text-sm text-background hover:scale-[1.02] transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {harvesting === m.id ? (
                    <>🤖 AI Bot 수확 중...</>
                  ) : (
                    <><Sparkles className="w-4 h-4" /> 수확하기 (+{formatKRW(m.daily_return)})<Zap className="w-4 h-4" /></>
                  )}
                </button>
              ) : (
                <div className="w-full py-3 rounded-xl glass border border-border text-center text-xs text-muted-foreground">
                  다음 수확까지 <span className="font-mono font-bold text-gold">{nextHarvestCountdown()}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
