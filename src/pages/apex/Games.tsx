import { Link } from "react-router-dom";
import { Dice5, Rocket, Triangle, Bomb, Sparkles, Trophy, ArrowRight } from "lucide-react";
import { GlowCard } from "@/packages/apex/components/GlowCard";

const GAMES = [
  { to: "/apex/games/dice",   label: "DICE",   sub: "1.01x → 9900x · HE 1%",  icon: Dice5,    glow: "neon" as const },
  { to: "/apex/games/crash",  label: "CRASH",  sub: "Live multiplier · HE 1%", icon: Rocket,   glow: "neon" as const },
  { to: "/apex/games/plinko", label: "PLINKO", sub: "12 rows · up to 33x",     icon: Triangle, glow: "neon" as const },
  { to: "/apex/games/mines",  label: "MINES",  sub: "5×5 · 1~20 mines",        icon: Bomb,     glow: "magenta" as const },
  { to: "/apex/games/slots",  label: "SLOTS LITE", sub: "3-reel · HE 3%",      icon: Sparkles, glow: "magenta" as const },
  { to: "/apex/sportsbook",   label: "SPORTSBOOK", sub: "PHON · USDT live odds", icon: Trophy, glow: "magenta" as const },
];

export default function ApexGames() {
  return (
    <div className="space-y-6">
      <div>
        <span className="inline-block text-[10px] uppercase tracking-[0.3em] text-primary border border-primary/40 rounded-full px-3 py-1">
          Stake · Rollbit 압살 라인업
        </span>
        <h1 className="mt-3 text-4xl md:text-5xl font-black apex-gradient-text">GAMES</h1>
        <p className="mt-2 text-sm text-muted-foreground">전부 Provably Fair · 일일 50회 안전 캡 · 머니플로 안전</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {GAMES.map(({ to, label, sub, icon: Icon, glow }) => (
          <Link key={to} to={to} className="block group">
            <GlowCard glow={glow}>
              <div className="p-5 flex items-center gap-4">
                <div className={`w-14 h-14 rounded-xl ${glow === "neon" ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent"} flex items-center justify-center`}>
                  <Icon className="w-7 h-7" />
                </div>
                <div className="flex-1">
                  <div className="font-black text-lg">{label}</div>
                  <div className="text-xs text-muted-foreground">{sub}</div>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition" />
              </div>
            </GlowCard>
          </Link>
        ))}
      </div>
    </div>
  );
}
