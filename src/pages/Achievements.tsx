import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useDB, formatKRW } from "@/lib/store";
import { toast } from "@/hooks/use-toast";
import { Trophy, Lock } from "lucide-react";

type Ach = {
  key: string; name: string; description: string; category: string;
  ap: number; reward_credit: number; badge_tier: string | null; sort_order: number;
};
type UA = { achievement_key: string; unlocked_at: string };

const TIER_COLORS: Record<string, string> = {
  bronze: "from-amber-700 to-amber-900",
  silver: "from-slate-300 to-slate-500",
  gold: "from-yellow-400 to-amber-600",
  platinum: "from-cyan-300 to-blue-500",
  diamond: "from-fuchsia-400 to-purple-600",
  mythic: "from-rose-400 via-fuchsia-500 to-violet-600",
};

export default function Achievements() {
  const [db] = useDB();
  const [catalog, setCatalog] = useState<Ach[]>([]);
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<string>("all");

  useEffect(() => {
    (async () => {
      const [c, m] = await Promise.all([
        supabase.from("achievements_catalog" as any).select("*").order("sort_order"),
        db.user ? supabase.from("user_achievements" as any).select("achievement_key").eq("user_id", db.user.id) : Promise.resolve({ data: [] as any }),
      ]);
      setCatalog((c.data as any) ?? []);
      setMine(new Set(((m as any).data ?? []).map((x: UA) => x.achievement_key)));
    })();
  }, [db.user]);

  const cats = ["all", ...Array.from(new Set(catalog.map((c) => c.category)))];
  const filtered = tab === "all" ? catalog : catalog.filter((c) => c.category === tab);
  const unlockedCount = mine.size;
  const totalAp = catalog.filter((c) => mine.has(c.key)).reduce((s, c) => s + c.ap, 0);

  return (
    <Layout>
      <div className="space-y-6 pb-24">
        <header className="rounded-3xl bg-gradient-to-br from-primary/15 via-background to-background border border-primary/20 p-6">
          <div className="flex items-center gap-3">
            <Trophy className="text-primary" />
            <h1 className="text-2xl font-black tracking-tight">업적</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">달성한 업적을 모아 자랑하세요</p>
          <div className="grid grid-cols-3 gap-3 mt-5">
            <Stat label="해금" value={`${unlockedCount} / ${catalog.length}`} />
            <Stat label="누적 AP" value={`${totalAp}`} />
            <Stat label="달성률" value={catalog.length ? `${Math.round((unlockedCount / catalog.length) * 100)}%` : "0%"} />
          </div>
        </header>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setTab(c)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition ${
                tab === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {c.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((a) => {
            const unlocked = mine.has(a.key);
            const grad = TIER_COLORS[a.badge_tier ?? "bronze"] ?? TIER_COLORS.bronze;
            return (
              <div
                key={a.key}
                className={`relative rounded-2xl border p-4 overflow-hidden ${
                  unlocked ? "border-primary/30 bg-card" : "border-border bg-muted/30"
                }`}
              >
                <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full bg-gradient-to-br ${grad} ${unlocked ? "opacity-30" : "opacity-5"} blur-2xl`} />
                <div className="relative flex items-start gap-3">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center text-2xl ${unlocked ? "" : "grayscale opacity-50"}`}>
                    {unlocked ? "🏆" : <Lock size={20} className="text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold truncate">{a.name}</h3>
                      <span className="text-[10px] uppercase font-bold opacity-70">{a.badge_tier}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs">
                      <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary font-bold">+{a.ap} AP</span>
                      {a.reward_credit > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 font-bold">{formatKRW(a.reward_credit)}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background/50 border border-border p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-lg font-black mt-1">{value}</div>
    </div>
  );
}
