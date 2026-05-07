import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useDB, formatKRW } from "@/lib/store";
import { toast } from "@/hooks/use-toast";
import { Crown, Gift, Lock, Sparkles } from "lucide-react";

type Reward = { id: string; level: number; free_reward: any; premium_reward: any };
type Season = { id: string; name: string; starts_at: string; ends_at: string; max_level: number; premium_price: number };
type Progress = { xp: number; level: number; premium: boolean; free_claimed: number[]; premium_claimed: number[]; next_level_xp: number };

export default function SeasonPass() {
  const [db] = useDB();
  const [season, setSeason] = useState<Season | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);

  async function load() {
    const { data: ov } = await supabase.rpc("get_season_overview" as any);
    const o = ov as any;
    setSeason(o?.season ?? null);
    setProgress(o?.progress ?? null);
    if (o?.season?.id) {
      const { data } = await supabase
        .from("season_pass_rewards" as any)
        .select("*")
        .eq("season_id", o.season.id)
        .order("level");
      setRewards((data as any) ?? []);
    }
  }
  useEffect(() => { load(); }, [db.user]);

  async function claim(level: number, track: "free" | "premium") {
    const { data, error } = await supabase.rpc("claim_season_reward" as any, { _level: level, _track: track });
    if (error) return toast({ title: "수령 실패", description: error.message, variant: "destructive" });
    const r = data as any;
    toast({ title: "보상 수령!", description: r.credit ? formatKRW(r.credit) : (r.badge ? `배지 획득: ${r.badge}` : "완료") });
    load();
  }

  async function buyPass() {
    const { error } = await supabase.rpc("purchase_season_pass" as any);
    if (error) return toast({ title: "구매 실패", description: error.message, variant: "destructive" });
    toast({ title: "프리미엄 패스 활성화!" });
    load();
  }

  const xpPct = progress && progress.next_level_xp ? Math.min(100, Math.round((progress.xp / progress.next_level_xp) * 100)) : 0;
  const daysLeft = season ? Math.max(0, Math.ceil((new Date(season.ends_at).getTime() - Date.now()) / 86400000)) : 0;

  return (
    <Layout>
      <div className="space-y-6 pb-24">
        <header className="rounded-3xl bg-gradient-to-br from-fuchsia-500/15 via-background to-background border border-fuchsia-500/20 p-6 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 opacity-20 blur-3xl" />
          <div className="relative">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="text-fuchsia-400" />
                  <h1 className="text-2xl font-black tracking-tight">{season?.name ?? "시즌 패스"}</h1>
                </div>
                <p className="text-xs text-muted-foreground mt-1">남은 기간: {daysLeft}일</p>
              </div>
              {progress && !progress.premium && (
                <button onClick={buyPass}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white font-bold text-sm shadow-lg shadow-fuchsia-500/40 hover:scale-105 transition">
                  <Crown size={14} className="inline mr-1" /> 프리미엄 활성화 {season ? `(${formatKRW(season.premium_price)})` : ""}
                </button>
              )}
              {progress?.premium && (
                <span className="px-4 py-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white font-bold text-xs">
                  ✨ PREMIUM
                </span>
              )}
            </div>
            {progress && (
              <div className="mt-5">
                <div className="flex items-baseline justify-between text-xs mb-2">
                  <span className="font-bold">Lv. {progress.level}</span>
                  <span className="text-muted-foreground">{progress.xp.toLocaleString()} / {progress.next_level_xp.toLocaleString()} XP</span>
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-fuchsia-500 to-violet-600 transition-all" style={{ width: `${xpPct}%` }} />
                </div>
              </div>
            )}
          </div>
        </header>

        <div className="space-y-2">
          <div className="grid grid-cols-[60px_1fr_1fr] gap-2 text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-2">
            <div>Lv</div>
            <div>무료</div>
            <div className="text-fuchsia-400">프리미엄</div>
          </div>
          {rewards.map((r) => {
            const unlocked = (progress?.level ?? 0) >= r.level;
            const freeClaimed = (progress?.free_claimed ?? []).includes(r.level);
            const premClaimed = (progress?.premium_claimed ?? []).includes(r.level);
            const isPrem = !!progress?.premium;
            return (
              <div key={r.id} className={`grid grid-cols-[60px_1fr_1fr] gap-2 items-center rounded-xl border p-2 ${unlocked ? "border-primary/30 bg-card" : "border-border bg-muted/20"}`}>
                <div className={`text-center font-black text-lg ${unlocked ? "text-primary" : "text-muted-foreground"}`}>{r.level}</div>
                <RewardCell reward={r.free_reward} unlocked={unlocked} claimed={freeClaimed} onClaim={() => claim(r.level, "free")} />
                <RewardCell reward={r.premium_reward} unlocked={unlocked && isPrem} claimed={premClaimed} onClaim={() => claim(r.level, "premium")} premium />
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}

function RewardCell({ reward, unlocked, claimed, onClaim, premium }: any) {
  const credit = reward?.credit ?? 0;
  const badge = reward?.badge;
  return (
    <button
      disabled={!unlocked || claimed}
      onClick={onClaim}
      className={`relative rounded-lg p-2 text-left text-xs transition ${
        claimed ? "bg-muted/30 opacity-50" :
        unlocked ? (premium ? "bg-gradient-to-br from-fuchsia-500/20 to-violet-600/20 hover:from-fuchsia-500/30 hover:to-violet-600/30 border border-fuchsia-500/30" : "bg-primary/15 hover:bg-primary/25 border border-primary/20") :
        "bg-muted/10 border border-border"
      }`}
    >
      {!unlocked && <Lock size={10} className="absolute top-1 right-1 text-muted-foreground" />}
      {claimed && <span className="absolute top-1 right-1 text-[10px] text-muted-foreground">✓</span>}
      <div className="flex items-center gap-1.5">
        {badge ? <span className="text-base">🎖️</span> : <Gift size={12} />}
        <div>
          {credit > 0 && <div className="font-bold">{formatKRW(credit)}</div>}
          {badge && <div className="font-bold">배지</div>}
        </div>
      </div>
    </button>
  );
}
