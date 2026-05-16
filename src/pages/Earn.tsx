import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Gift } from "lucide-react";
import { Link } from "react-router-dom";
import SlimShell from "@/components/layout/SlimShell";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useEarnHub } from "@/hooks/use-earn-hub";
import StreakCard from "@/components/earn/StreakCard";
import MissionsCard from "@/components/earn/MissionsCard";
import ReferralCard from "@/components/earn/ReferralCard";
import PlayToEarnCard from "@/components/earn/PlayToEarnCard";
import ShareRewardCard from "@/components/earn/ShareRewardCard";

function useCountUp(target: number, ms = 600) {
  const [n, setN] = useState(target);
  useEffect(() => {
    if (n === target) return;
    const start = n;
    const startedAt = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - startedAt) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(start + (target - start) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return n;
}

export default function Earn() {
  const user = useRequireAuth();
  const { state, loading, claim, claimShare, claimAttendance } = useEarnHub();
  const earned = useCountUp(state.today_earned);

  if (!user) return null;

  return (
    <SlimShell>
      <div className="container py-5 space-y-5 max-w-3xl">
        <motion.header
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-3xl border border-primary/30 bg-card p-6 relative overflow-hidden"
        >
          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-primary/15 blur-3xl" aria-hidden />
          <div className="flex items-end justify-between gap-3 relative">
            <div>
              <div className="text-[10px] tracking-[0.3em] font-black text-primary uppercase">매일 무료 수익</div>
              <h1 className="text-2xl md:text-3xl font-black text-foreground mt-1">오늘 얼마 벌었나요?</h1>
              <p className="text-xs text-muted-foreground mt-1">
                아래 5가지만 다 하면 매일 4,000~6,000 PHON 확보
              </p>
            </div>
            <Link
              to="/events"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-primary/30 bg-background/40 text-xs font-bold text-primary"
            >
              <Gift className="w-3.5 h-3.5" /> 이벤트
            </Link>
          </div>

          <div className="mt-5 flex items-end gap-2 relative">
            <div className="text-5xl md:text-6xl font-black text-primary tabular-nums leading-none">
              {earned.toLocaleString()}
            </div>
            <div className="text-lg font-bold text-foreground/70 pb-1">PHON</div>
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">오늘 누적 적립</div>
        </motion.header>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-56 rounded-2xl border border-border/40 bg-card animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <StreakCard
              days={state.streak.days}
              claimedToday={state.streak.claimed_today}
              nextReward={state.streak.next_reward}
              onClaim={claimAttendance}
            />
            <MissionsCard missions={state.missions} onClaim={claim} />
            <ReferralCard
              code={state.referral.code}
              invited={state.referral.invited}
              earnedTotal={state.referral.earned_total}
            />
            <PlayToEarnCard
              claimed={state.play_today.claimed}
              amount={state.play_today.amount}
              onClaim={() => claim("play_today")}
            />
            <ShareRewardCard
              claimedChannels={state.share_today.channels}
              amountEach={state.share_today.amount_each}
            />
          </div>
        )}
      </div>
    </SlimShell>
  );
}
