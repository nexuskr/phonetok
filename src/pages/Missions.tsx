import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { useDB, MISSIONS, formatKRW, type Mission } from "@/lib/store";
import { CheckCircle2, Sparkles, Filter } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const cats = ["전체", "광고", "설문", "리뷰", "추천", "데이터", "AI"] as const;

export default function Missions() {
  const [db, setDb] = useDB();
  const nav = useNavigate();
  const [cat, setCat] = useState<(typeof cats)[number]>("전체");
  const [completing, setCompleting] = useState<string | null>(null);

  if (!db.user) { nav("/auth"); return null; }

  const list = MISSIONS.filter(m => cat === "전체" || m.category === cat);

  function complete(m: Mission) {
    if (db.completedMissions.includes(m.id)) {
      toast({ title: "이미 완료한 미션입니다" }); return;
    }
    setCompleting(m.id);
    setTimeout(() => {
      setDb(d => ({
        ...d,
        completedMissions: [...d.completedMissions, m.id],
        user: d.user ? {
          ...d.user,
          balance: d.user.balance + m.reward,
          todayEarnings: d.user.todayEarnings + m.reward,
          xp: d.user.xp + Math.floor(m.reward / 100),
        } : null,
      }));
      setCompleting(null);
      toast({ title: `🎉 +${formatKRW(m.reward)} 적립`, description: `${m.title} 완료!` });
    }, 1500);
  }

  return (
    <Layout>
      <div className="container pt-6 pb-10">
        <div className="mb-6">
          <h1 className="font-display font-black text-2xl flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" /> <span className="text-gradient-primary">사이버 미션</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">완료 즉시 자동 정산되는 실시간 보상 미션</p>
        </div>

        {/* Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5 mb-5">
          {cats.map(c => (
            <button key={c} onClick={() => setCat(c)}
              className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold transition ${cat === c ? "bg-gradient-primary text-primary-foreground glow-primary" : "glass text-muted-foreground"}`}>
              {c}
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {list.map(m => {
            const done = db.completedMissions.includes(m.id);
            const inProgress = completing === m.id;
            return (
              <div key={m.id} className="glass-strong rounded-2xl p-4 neon-border tilt-card relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-gradient-primary blur-2xl opacity-30" />
                {done && <div className="absolute inset-0 bg-secondary/10 backdrop-blur-sm flex items-center justify-center"><div className="flex items-center gap-2 text-secondary font-bold"><CheckCircle2 className="w-5 h-5" /> 완료</div></div>}
                <div className="relative">
                  <div className="flex items-center justify-between text-[10px] mb-2">
                    <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary font-bold">{m.category}</span>
                    <span className={`px-2 py-0.5 rounded-full font-bold ${m.difficulty === "VIP" ? "bg-gold/20 text-gold" : m.difficulty === "HARD" ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"}`}>{m.difficulty}</span>
                  </div>
                  <h3 className="font-bold text-sm leading-snug">{m.title}</h3>
                  <p className="text-[11px] text-muted-foreground mt-1">{m.desc}</p>
                  <div className="flex items-center justify-between mt-4">
                    <div>
                      <div className="font-display font-black text-xl text-gradient-gold">+{formatKRW(m.reward)}</div>
                      <div className="text-[10px] text-muted-foreground">소요 {m.duration}</div>
                    </div>
                    <button disabled={done || inProgress} onClick={() => complete(m)}
                      className="px-4 py-2 rounded-xl bg-gradient-primary text-primary-foreground text-xs font-bold glow-primary disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition">
                      {inProgress ? "진행 중..." : done ? "완료됨" : "시작하기"}
                    </button>
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
