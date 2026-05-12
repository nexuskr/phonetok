// PR-3: Empire Level Badge — shows current level + progress to next.
// PR-11: Crown Aura 시각 적용.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Crown } from "lucide-react";
import CrownAura from "@/components/empire/CrownAura";

type Level = { level: number; name: string; crown_required: number; perks: any };

export default function EmpireLevelBadge({ compact = false }: { compact?: boolean }) {
  const [score, setScore] = useState<number>(0);
  const [level, setLevel] = useState<number>(1);
  const [levels, setLevels] = useState<Level[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const [profileRes, levelsRes] = await Promise.all([
        user ? supabase.from("profiles").select("empire_level, crown_score").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null } as any),
        supabase.from("empire_levels").select("level, name, crown_required, perks").order("level"),
      ]);
      if (!alive) return;
      if (profileRes.data) {
        setScore(Number(profileRes.data.crown_score) || 0);
        setLevel(Number(profileRes.data.empire_level) || 1);
      }
      if (levelsRes.data) setLevels(levelsRes.data as Level[]);
    })();

    const ch = supabase
      .channel("empire-level-self")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, (p: any) => {
        if (p.new?.crown_score !== undefined) {
          setScore(Number(p.new.crown_score) || 0);
          setLevel(Number(p.new.empire_level) || 1);
        }
      })
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, []);

  const cur = levels.find(l => l.level === level);
  const next = levels.find(l => l.level === level + 1);
  const curBadge = (cur?.perks?.badge as string) || "🪙";
  const progress = next
    ? Math.min(100, Math.max(0, ((score - (cur?.crown_required ?? 0)) / (next.crown_required - (cur?.crown_required ?? 0))) * 100))
    : 100;

  if (compact) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md glass border border-sim-gold/30 text-xs">
        <CrownAura level={level} size={18}>
          <span className="text-[12px] leading-none">{curBadge}</span>
        </CrownAura>
        <span className="font-bold tabular-nums">L{level}</span>
        <span className="text-muted-foreground tabular-nums">{score.toLocaleString()}₡</span>
      </div>
    );
  }

  return (
    <div className="glass-strong rounded-xl p-3 border border-sim-gold/30">
      <div className="flex items-center gap-3">
        <CrownAura level={level} size={42}>
          <span className="text-2xl leading-none">{curBadge}</span>
        </CrownAura>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-imperial text-sm tracking-wider text-gradient-imperial">
              Lv {level} · {cur?.name ?? "Citizen"}
            </span>
            <Crown className="w-3 h-3 text-sim-gold" />
            <span className="text-xs tabular-nums text-muted-foreground">{score.toLocaleString()} Crown</span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-muted/40 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-sim-gold to-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
          {next ? (
            <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
              다음 등급 {next.name}까지 {(next.crown_required - score).toLocaleString()} Crown
            </div>
          ) : (
            <div className="text-[10px] text-sim-gold mt-0.5">최고 레벨 도달 · Mars 🚀</div>
          )}
        </div>
      </div>
    </div>
  );
}
