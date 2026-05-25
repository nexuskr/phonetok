import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Flame, Gift, Target, Share2, Wallet as WalletIcon, TrendingUp, Gem, ChevronRight } from "lucide-react";
import { useProfile, useBalance } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";
import { rewardBurst } from "@/components/feedback/RewardBurst";
import CountUp from "@/components/feedback/CountUp";
import LiveTicker from "@/components/feedback/LiveTicker";
import { fmtKRW } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

const TILES = [
  { to: "/trade", icon: TrendingUp, title: "트레이드", desc: "BTC · ETH 예측", grad: "from-secondary/30 to-card" },
  { to: "/slots", icon: Gem, title: "슬롯", desc: "Olympus 1000", grad: "from-accent/30 to-card" },
  { to: "/wallet", icon: WalletIcon, title: "지갑", desc: "잔액 / 출금", grad: "from-primary/30 to-card" },
  { to: "/refer", icon: Share2, title: "친구 초대", desc: "양쪽 +5,000", grad: "from-pink/30 to-card" },
];

export default function Home() {
  const { data: profile } = useProfile();
  const { data: balance = 0 } = useBalance();
  const qc = useQueryClient();
  const [claiming, setClaiming] = useState(false);
  const claimedToday = profile?.last_attendance === new Date().toISOString().slice(0, 10);

  const claim = async () => {
    if (claiming || claimedToday) return;
    setClaiming(true);
    try {
      const { data, error } = await supabase.rpc("claim_daily_attendance_v2");
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const reward = Number(row?.reward ?? 0);
      const weekly = Number(row?.weekly_bonus ?? 0);
      if (reward > 0) {
        rewardBurst();
        notify.reward(reward + weekly);
        qc.invalidateQueries({ queryKey: ["profile"] });
        qc.invalidateQueries({ queryKey: ["phon_balance"] });
      } else {
        notify.info("오늘은 이미 출석했어요");
      }
    } catch (err) {
      notify.error("출석 실패", err instanceof Error ? err.message : String(err));
    } finally {
      setClaiming(false);
    }
  };

  return (
    <main className="container mx-auto px-4 pt-5 pb-10 space-y-5 max-w-2xl">
      {/* Balance hero */}
      <motion.section
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl p-6 bg-[image:var(--gradient-imperial)] shadow-[var(--glow-gold)] text-primary-foreground relative overflow-hidden"
      >
        <div className="text-xs font-bold opacity-80">총 잔액</div>
        <div className="mt-1 text-4xl font-black flex items-baseline gap-2">
          <CountUp value={balance} /> <span className="text-base">PHON</span>
        </div>
        <div className="text-xs opacity-80 mt-1">≈ {fmtKRW(balance)}</div>
        <div className="mt-4 flex gap-2">
          <Link to="/wallet" className="px-4 py-2 rounded-xl bg-primary-foreground/15 backdrop-blur text-sm font-semibold">출금</Link>
          <Link to="/refer" className="px-4 py-2 rounded-xl bg-primary-foreground/15 backdrop-blur text-sm font-semibold">친구초대</Link>
        </div>
      </motion.section>

      {/* Attendance */}
      <motion.button
        whileTap={{ scale: 0.97 }} onClick={claim} disabled={claimedToday || claiming}
        className={`w-full rounded-2xl p-5 border text-left transition ${
          claimedToday
            ? "bg-card border-border opacity-70"
            : "bg-gradient-to-r from-primary/15 to-pink/15 border-primary/30 hover:border-primary"
        }`}
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-pink grid place-items-center text-3xl shadow-[var(--glow-gold)]">
            🔥
          </div>
          <div className="flex-1">
            <div className="font-black text-lg">
              {claimedToday ? "오늘 출석 완료" : "오늘의 출석 보상"}
            </div>
            <div className="text-sm text-muted-foreground">
              연속 <span className="text-primary font-bold">{profile?.attendance_streak ?? 0}일</span> · 7일마다 1배 보너스
            </div>
          </div>
          {!claimedToday && <Gift className="h-6 w-6 text-primary" />}
        </div>
      </motion.button>

      {/* Quick missions */}
      <section>
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="font-black text-lg flex items-center gap-2"><Target className="h-5 w-5 text-primary" />오늘의 미션</h2>
          <Link to="/refer" className="text-xs text-muted-foreground flex items-center gap-1">더보기 <ChevronRight className="h-3 w-3" /></Link>
        </div>
        <div className="space-y-2">
          {[
            { code: "welcome_tap", title: "출석 미션", reward: 500 },
            { code: "share_app", title: "앱 공유하기", reward: 1000 },
            { code: "invite_friend", title: "친구 1명 초대", reward: 5000 },
          ].map((m) => (
            <button
              key={m.code}
              onClick={async () => {
                try {
                  await supabase.rpc("claim_free_mission", { _code: m.code });
                  notify.reward(m.reward);
                  qc.invalidateQueries({ queryKey: ["phon_balance"] });
                } catch (e) {
                  notify.info("이미 완료했거나 조건 미충족");
                }
              }}
              className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-card border border-border hover:border-primary/40 transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/15 grid place-items-center text-primary"><Flame className="h-4 w-4" /></div>
                <span className="font-semibold text-sm">{m.title}</span>
              </div>
              <span className="text-primary font-bold text-sm">+{m.reward.toLocaleString()} PHON</span>
            </button>
          ))}
        </div>
      </section>

      {/* Tiles */}
      <section className="grid grid-cols-2 gap-3">
        {TILES.map(({ to, icon: Icon, title, desc, grad }) => (
          <Link key={to} to={to} className={`rounded-2xl bg-gradient-to-br ${grad} border border-border p-4 hover:border-primary/40 transition`}>
            <Icon className="h-6 w-6 text-primary" />
            <div className="mt-3 font-bold">{title}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
          </Link>
        ))}
      </section>

      {/* Live ticker */}
      <section>
        <h2 className="font-black text-lg mb-2 px-1">🔴 실시간</h2>
        <LiveTicker />
      </section>
    </main>
  );
}
