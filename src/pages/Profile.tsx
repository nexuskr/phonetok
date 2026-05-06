import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { useDB, formatKRW } from "@/lib/store";
import { ShieldCheck, Star, Trophy, Settings, Award } from "lucide-react";

export default function Profile() {
  const [db] = useDB();
  const nav = useNavigate();
  if (!db.user) { nav("/auth"); return null; }
  const u = db.user;
  const xpToNext = u.level * 1000;
  const pct = Math.min(100, (u.xp / xpToNext) * 100);

  return (
    <Layout>
      <div className="container pt-6 pb-10">
        <div className="glass-strong rounded-3xl p-6 neon-border relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-44 h-44 rounded-full bg-gradient-primary blur-3xl opacity-40" />
          <div className="relative flex items-center gap-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-gradient-cyber flex items-center justify-center font-display font-black text-3xl text-foreground glow-primary">
                {u.nickname[0]?.toUpperCase()}
              </div>
              <div className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-full bg-gold text-gold-foreground text-[10px] font-black">Lv.{u.level}</div>
            </div>
            <div className="flex-1">
              <h2 className="font-display font-black text-xl">{u.nickname}</h2>
              <p className="text-xs text-muted-foreground">{u.email}</p>
              <div className="mt-2">
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>XP {u.xp}</span><span>{xpToNext}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-primary glow-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="relative grid grid-cols-3 gap-2 mt-5">
            <Card icon={Trophy} label="누적" v={formatKRW(u.balance)} />
            <Card icon={Star} label="오늘" v={formatKRW(u.todayEarnings)} />
            <Card icon={Award} label="연속" v={`${u.streak}일`} />
          </div>
        </div>

        <div className="mt-5 space-y-2">
          {[
            { icon: ShieldCheck, label: "보안 설정", sub: "비밀번호 · 2FA" },
            { icon: Settings, label: "계정 설정", sub: "프로필 · 알림" },
            { icon: Trophy, label: "업적", sub: "12개 달성 / 50개" },
          ].map((m, i) => (
            <button key={i} className="w-full glass rounded-2xl p-4 flex items-center gap-3 hover:bg-muted/30 transition text-left">
              <div className="w-10 h-10 rounded-xl bg-gradient-primary/20 flex items-center justify-center"><m.icon className="w-4 h-4 text-primary" /></div>
              <div className="flex-1">
                <div className="text-sm font-bold">{m.label}</div>
                <div className="text-[10px] text-muted-foreground">{m.sub}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </Layout>
  );
}

function Card({ icon: Icon, label, v }: any) {
  return (
    <div className="glass rounded-xl p-3 text-center">
      <Icon className="w-4 h-4 mx-auto text-primary" />
      <div className="text-[10px] text-muted-foreground mt-1">{label}</div>
      <div className="font-display font-bold text-xs">{v}</div>
    </div>
  );
}
