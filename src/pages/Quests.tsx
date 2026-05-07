import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useDB, formatKRW } from "@/lib/store";
import { toast } from "@/hooks/use-toast";
import { CheckCircle2, Clock, Zap } from "lucide-react";

type Q = {
  key: string; name: string; description: string; period: "daily" | "weekly";
  target: number; progress: number; claimed: boolean; xp: number; credit: number;
};

export default function Quests() {
  const [db] = useDB();
  const [quests, setQuests] = useState<Q[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!db.user) return;
    setLoading(true);
    const { data } = await supabase.rpc("get_my_quests" as any);
    setQuests((data as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [db.user]);

  async function claim(key: string) {
    const { data, error } = await supabase.rpc("claim_quest" as any, { _quest_key: key });
    if (error) return toast({ title: "수령 실패", description: error.message, variant: "destructive" });
    const r = data as any;
    toast({ title: "보상 수령!", description: `+${r.xp} XP / ${formatKRW(r.credit)}` });
    load();
  }

  const daily = quests.filter((q) => q.period === "daily");
  const weekly = quests.filter((q) => q.period === "weekly");

  return (
    <Layout>
      <div className="space-y-6 pb-24">
        <header className="rounded-3xl bg-gradient-to-br from-amber-500/15 via-background to-background border border-amber-500/20 p-6">
          <div className="flex items-center gap-3">
            <Zap className="text-amber-500" />
            <h1 className="text-2xl font-black tracking-tight">퀘스트</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">매일·매주 도전하고 XP와 크레딧을 획득하세요</p>
        </header>

        <Section title="일일 퀘스트" icon={<Clock size={18} />} quests={daily} onClaim={claim} loading={loading} />
        <Section title="주간 퀘스트" icon={<Clock size={18} />} quests={weekly} onClaim={claim} loading={loading} />
      </div>
    </Layout>
  );
}

function Section({ title, icon, quests, onClaim, loading }: any) {
  return (
    <section>
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">{icon}{title}</h2>
      <div className="space-y-2">
        {loading && <div className="text-sm text-muted-foreground">로딩 중...</div>}
        {!loading && quests.length === 0 && <div className="text-sm text-muted-foreground">활성 퀘스트가 없습니다</div>}
        {quests.map((q: Q) => {
          const pct = Math.min(100, Math.round((q.progress / q.target) * 100));
          const done = q.progress >= q.target;
          return (
            <div key={q.key} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h3 className="font-bold">{q.name}</h3>
                  <p className="text-xs text-muted-foreground">{q.description}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary font-bold">+{q.xp} XP</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 font-bold">{formatKRW(q.credit)}</span>
                  </div>
                </div>
                <button
                  disabled={!done || q.claimed}
                  onClick={() => onClaim(q.key)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                    q.claimed ? "bg-muted text-muted-foreground" :
                    done ? "bg-primary text-primary-foreground hover:opacity-90" :
                    "bg-muted text-muted-foreground"
                  }`}
                >
                  {q.claimed ? <CheckCircle2 size={14} /> : done ? "수령" : `${q.progress}/${q.target}`}
                </button>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary to-amber-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
