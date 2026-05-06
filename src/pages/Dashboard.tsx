import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import Particles from "@/components/Particles";
import { useDB, MISSIONS, formatKRW } from "@/lib/store";
import { Flame, Zap, Trophy, ChevronRight, TrendingUp, Sparkles, Crown, Wallet } from "lucide-react";

export default function Dashboard() {
  const [db] = useDB();
  const nav = useNavigate();
  const user = db.user;
  const [burst, setBurst] = useState(false);

  useEffect(() => { if (!user) nav("/auth"); }, [user, nav]);
  if (!user) return null;

  const featured = MISSIONS.slice(0, 5);

  return (
    <Layout>
      <div className="relative">
        <div className="absolute inset-0 bg-grid opacity-20 pointer-events-none" />
        <Particles density={40} />

        <div className="container relative pt-6 pb-10">
          {/* Greeting */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs text-muted-foreground">안녕하세요</p>
              <h1 className="font-display font-bold text-xl">
                <span className="text-gradient-primary">{user.nickname}</span>님 👋
              </h1>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass">
              <Flame className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold">{user.streak}일 연속</span>
            </div>
          </div>

          {/* Balance hero */}
          <div className="relative animate-fade-up">
            <div className="absolute inset-0 bg-gradient-cyber blur-3xl opacity-50 -z-10" />
            <div className="glass-strong rounded-3xl p-7 neon-border relative overflow-hidden">
              <div className="absolute inset-0 bg-grid opacity-20" />
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-gradient-primary blur-3xl opacity-50 animate-float" />
              <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-accent/60 blur-3xl animate-float-slow" />

              {/* money burst */}
              {burst && (
                <div className="absolute inset-0 pointer-events-none">
                  {Array.from({ length: 14 }).map((_, i) => {
                    const angle = (i / 14) * Math.PI * 2;
                    const tx = Math.cos(angle) * 200;
                    const ty = Math.sin(angle) * 200 - 50;
                    return (
                      <span key={i} className="absolute left-1/2 top-1/2 text-2xl animate-money-burst"
                        style={{ ["--tx" as any]: `${tx}px`, ["--ty" as any]: `${ty}px`, ["--r" as any]: `${i * 25}deg` }}>
                        💸
                      </span>
                    );
                  })}
                </div>
              )}

              <div className="relative">
                <div className="text-xs text-muted-foreground tracking-widest">현재 잔고</div>
                <button onClick={() => { setBurst(true); setTimeout(() => setBurst(false), 1600); }}
                  className="font-display font-black text-4xl sm:text-5xl mt-2 text-gradient-gold block hover:scale-105 transition">
                  {formatKRW(user.balance)}
                </button>
                <div className="mt-3 flex items-center gap-2 text-xs text-secondary">
                  <TrendingUp className="w-3.5 h-3.5" /> 오늘 +{formatKRW(user.todayEarnings)} 적립됨
                </div>
              </div>

              <div className="relative grid grid-cols-3 gap-2 mt-6">
                <Stat icon={Flame} label="연속" value={`${user.streak}일`} color="text-primary" />
                <Stat icon={Zap} label="레벨" value={`Lv.${user.level}`} color="text-secondary" />
                <Stat icon={Trophy} label="XP" value={`${user.xp}`} color="text-gold" />
              </div>

              <div className="relative grid grid-cols-2 gap-2 mt-3">
                <Link to="/wallet" className="py-3 rounded-xl bg-gradient-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-1.5 glow-primary">
                  <Wallet className="w-4 h-4" /> 출금하기
                </Link>
                <Link to="/packages" className="py-3 rounded-xl glass border border-border font-bold text-sm flex items-center justify-center gap-1.5">
                  <Crown className="w-4 h-4 text-gold" /> 패키지
                </Link>
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-4 gap-2 mt-5">
            {[
              { to: "/missions", label: "미션", icon: "🎯", grad: "from-primary/20 to-primary/5" },
              { to: "/packages", label: "패키지", icon: "👑", grad: "from-gold/20 to-gold/5" },
              { to: "/wallet", label: "충전", icon: "💎", grad: "from-secondary/20 to-secondary/5" },
              { to: "/wallet", label: "출금", icon: "💸", grad: "from-accent/20 to-accent/5" },
            ].map((a, i) => (
              <Link key={i} to={a.to} className={`glass rounded-2xl p-3 flex flex-col items-center gap-1 bg-gradient-to-b ${a.grad} hover:scale-105 transition`}>
                <span className="text-2xl">{a.icon}</span>
                <span className="text-[11px] font-bold">{a.label}</span>
              </Link>
            ))}
          </div>

          {/* Featured missions horizontal */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-bold text-lg flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" /> 오늘의 추천 미션
              </h2>
              <Link to="/missions" className="text-xs text-muted-foreground hover:text-foreground flex items-center">전체 <ChevronRight className="w-3 h-3" /></Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-3 -mx-5 px-5 snap-x snap-mandatory">
              {featured.map((m, i) => (
                <Link key={m.id} to="/missions" className="snap-start shrink-0 w-64 glass-strong rounded-2xl p-4 neon-border tilt-card relative overflow-hidden">
                  <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-gradient-primary blur-2xl opacity-40" />
                  <div className="flex items-center justify-between text-[10px] mb-2">
                    <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary font-bold">{m.category}</span>
                    <span className="text-muted-foreground">{m.duration}</span>
                  </div>
                  <h3 className="font-bold text-sm leading-snug">{m.title}</h3>
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{m.desc}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="font-display font-black text-lg text-gradient-gold">+{formatKRW(m.reward)}</div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${m.difficulty === "VIP" ? "bg-gold/20 text-gold" : "bg-muted text-muted-foreground"}`}>{m.difficulty}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Live ranking */}
          <div className="mt-8">
            <h2 className="font-display font-bold text-lg flex items-center gap-2 mb-3">
              <Trophy className="w-4 h-4 text-gold" /> 실시간 랭킹
            </h2>
            <div className="glass-strong rounded-2xl p-4 neon-border">
              {[
                { n: "사이버제왕", v: 38420000, c: "👑" },
                { n: "팬텀카운슬", v: 21800000, c: "🌌" },
                { n: "AI킹덤", v: 15600000, c: "🤖" },
                { n: "엠파이어", v: 9200000, c: "💎" },
                { n: "스타터러너", v: 5400000, c: "⚡" },
              ].map((r, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center font-display font-black text-xs
                      ${i === 0 ? "bg-gradient-gold text-gold-foreground" : i === 1 ? "bg-secondary/30 text-secondary" : i === 2 ? "bg-accent/30 text-accent" : "bg-muted"}`}>
                      {i + 1}
                    </div>
                    <span className="text-2xl">{r.c}</span>
                    <span className="text-sm font-bold">{r.n}</span>
                  </div>
                  <div className="text-sm font-display font-bold text-gradient-primary">{formatKRW(r.v)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function Stat({ icon: Icon, label, value, color }: any) {
  return (
    <div className="glass rounded-xl p-3 text-center">
      <Icon className={`w-4 h-4 mx-auto ${color}`} />
      <div className="text-[10px] text-muted-foreground mt-1">{label}</div>
      <div className="font-display font-bold text-sm">{value}</div>
    </div>
  );
}
