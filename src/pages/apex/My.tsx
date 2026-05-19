import { Link } from "react-router-dom";
import { Wallet, Trophy, Flame, ChevronRight, Crown, Sparkles } from "lucide-react";

export default function ApexMy() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl md:text-4xl font-black apex-gradient-text">My Apex</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ApexForge 활동 요약 — 지갑·출금은 Phonara 로 이동합니다.
        </p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Stat icon={Flame}   label="연속"  value="—" />
        <Stat icon={Trophy}  label="레벨"  value="—" />
        <Stat icon={Wallet}  label="PHON"  value="—" />
      </div>

      {/* Story strip */}
      <section className="apex-glass rounded-2xl p-5">
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">24h Story</p>
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="shrink-0 w-16 text-center">
              <div className="w-16 h-16 rounded-full apex-gradient p-[2px]">
                <div className="w-full h-full rounded-full bg-background flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
              </div>
              <p className="text-[10px] mt-1 text-muted-foreground">D-{i}</p>
            </div>
          ))}
        </div>
      </section>

      <ul className="space-y-2">
        <Row to="/wallet"             icon={Wallet}  label="지갑 · 출금 (Phonara)" />
        <Row to="/empire/collection"  icon={Crown}   label="NFT 컬렉션" />
        <Row to="/missions"           icon={Trophy}  label="기존 미션 허브" />
        <Row to="/dashboard"          icon={Sparkles} label="Phonara Command Center" />
      </ul>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="apex-glass rounded-2xl p-4 text-center">
      <Icon className="w-5 h-5 mx-auto text-primary" />
      <p className="text-[10px] uppercase text-muted-foreground mt-1">{label}</p>
      <p className="font-black apex-text-neon tabular-nums">{value}</p>
    </div>
  );
}

function Row({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <li>
      <Link
        to={to}
        className="apex-glass rounded-xl px-4 py-3 flex items-center justify-between hover:apex-glow-neon transition"
      >
        <span className="flex items-center gap-3">
          <Icon className="w-4 h-4 text-primary" />
          {label}
        </span>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </Link>
    </li>
  );
}
