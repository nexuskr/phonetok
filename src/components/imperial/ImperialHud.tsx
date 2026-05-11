import { Link } from "react-router-dom";
import { Flame, Trophy, Crown } from "lucide-react";
import { useImperialState, useBoosterCountdown } from "@/hooks/use-imperial-state";

function fmt(n: number) {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000)      return `${(n / 10_000).toFixed(0)}만`;
  return n.toLocaleString();
}

export default function ImperialHud() {
  const { state } = useImperialState();
  const remaining = useBoosterCountdown(state.booster_expires_at);
  const hasMilestone = !!state.next_milestone;

  return (
    <div className="container pt-2">
      <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/5 via-background to-background overflow-hidden">
        <div className="grid grid-cols-4 divide-x divide-border/40 text-center">
          {/* Imperial Score */}
          <Link to="/whales" className="px-2 py-2.5 hover:bg-primary/5 transition">
            <div className="text-[9px] font-bold tracking-[0.18em] text-primary/80 uppercase flex items-center justify-center gap-1">
              <Crown className="w-2.5 h-2.5" /> IS
            </div>
            <div className="font-imperial font-black text-base sm:text-lg text-gradient-imperial tabular-nums mt-0.5">
              {fmt(state.total_is)}
            </div>
            <div className="text-[9px] text-muted-foreground tabular-nums">오늘 +{fmt(state.daily_is)}</div>
          </Link>

          {/* Booster */}
          <div className="px-2 py-2.5">
            <div className="text-[9px] font-bold tracking-[0.18em] uppercase flex items-center justify-center gap-1 text-destructive/90">
              <Flame className="w-2.5 h-2.5" /> 부스터
            </div>
            {state.booster_active && remaining ? (
              <>
                <div className="font-imperial font-black text-base sm:text-lg text-destructive tabular-nums mt-0.5">×2</div>
                <div className="text-[9px] text-muted-foreground tabular-nums">{remaining}</div>
              </>
            ) : (
              <>
                <div className="font-imperial font-black text-base sm:text-lg text-muted-foreground/60 mt-0.5">OFF</div>
                <div className="text-[9px] text-muted-foreground">입금 시 24h</div>
              </>
            )}
          </div>

          {/* Next ladder */}
          <Link to="/packages" className="px-2 py-2.5 hover:bg-primary/5 transition">
            <div className="text-[9px] font-bold tracking-[0.18em] text-primary/80 uppercase">다음 단계</div>
            {hasMilestone ? (
              <>
                <div className="font-imperial font-black text-sm sm:text-base text-gradient-imperial tabular-nums mt-0.5 truncate">
                  +₩{fmt(state.next_milestone!.remaining_krw)}
                </div>
                <div className="text-[9px] text-muted-foreground truncate">{state.next_milestone!.label}</div>
              </>
            ) : (
              <>
                <div className="font-imperial font-black text-base text-gradient-imperial mt-0.5">MAX</div>
                <div className="text-[9px] text-muted-foreground">모든 단계 도달</div>
              </>
            )}
          </Link>

          {/* Whale rank */}
          <Link to="/whales" className="px-2 py-2.5 hover:bg-primary/5 transition">
            <div className="text-[9px] font-bold tracking-[0.18em] text-primary/80 uppercase flex items-center justify-center gap-1">
              <Trophy className="w-2.5 h-2.5" /> 오늘 순위
            </div>
            <div className="font-imperial font-black text-base sm:text-lg text-gradient-imperial tabular-nums mt-0.5">
              {state.whale_rank_today ? `#${state.whale_rank_today}` : "—"}
            </div>
            <div className="text-[9px] text-muted-foreground">SIM</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
