/**
 * /crash/imperial — Imperial Gold Empire Crash.
 *
 * Phase 3 luxury shell. Reuses every existing money-flow RPC from
 * `@/lib/crash` (placeBet/cashoutNow/getCurrentRound) and the realtime
 * shape from `useCrashRound`, so server logic and the existing /crash
 * page are untouched.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Crown, History, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ImperialCanvas, ImperialBetPanel, ImperialHistory,
  type BetTicket,
} from "@pkg/games/crash";
import type { BetUiState } from "@pkg/games/crash/components/ImperialBetPanel";
import { useCrashRound } from "@/components/crash/hooks/useCrashRound";
import {
  placeBet, cashoutNow, getRecentWins, friendlyError, getMyStats,
} from "@/lib/crash";
import { useProvablyFair } from "@pkg/games/core";
import { supabase } from "@/integrations/supabase/client";
import { useGameChannel } from "@pkg/realtime";
import { notify } from "@/lib/notify";
import { haptics } from "@/lib/haptics";

export default function CrashImperial() {
  const { round, mult } = useCrashRound();
  const qc = useQueryClient();
  const [uid, setUid] = useState<string | null>(null);
  const [bet, setBet] = useState(10000);
  const [autoCashout, setAutoCashout] = useState("2.00");
  const [betState, setBetState] = useState<BetUiState>("idle");
  const [ticket, setTicket] = useState<BetTicket | null>(null);
  const lastRoundIdRef = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);

  const phase: "idle" | "pending" | "running" | "crashed" =
    round.status === "none" ? "idle" : round.status;

  // Numeric round id for PF — best-effort, falls back to 0
  const numericRoundId = round.id
    ? Number(parseInt(round.id.replace(/-/g, "").slice(0, 12), 16)) || 0
    : 0;
  const pf = useProvablyFair("crash", numericRoundId || null);

  // Reset cycle
  useEffect(() => {
    if (phase === "pending" && (betState === "paid" || betState === "lost")) {
      setBetState("idle");
      setTicket(null);
    }
  }, [round.id, phase, betState]);

  // Mark loss on crash
  useEffect(() => {
    if (phase === "crashed" && betState === "placed") {
      setBetState("lost");
      haptics.error();
      notify.error(`💥 폭발 ${Number(round.last_crash ?? 0).toFixed(2)}x`);
      // reveal PF seed for the just-finished round
      pf.reveal().catch(() => {});
    }
  }, [phase, betState, round.last_crash, pf]);

  // Commit hash on pending phase
  useEffect(() => {
    if (phase === "pending" && numericRoundId) {
      pf.commit().catch(() => {});
    }
  }, [phase, numericRoundId, pf]);

  // Recent wins / history
  const { data: wins = [] } = useQuery({
    queryKey: ["crash-wins-imperial"],
    queryFn: () => getRecentWins(20),
    refetchInterval: 8000,
  });
  const { data: stats } = useQuery({
    queryKey: ["crash-stats-imperial", uid],
    queryFn: getMyStats,
    enabled: !!uid,
    staleTime: 5000,
  });

  // Realtime invalidation on my bets
  useGameChannel({
    key: uid ? `imperial-crash-bets:${uid}` : "",
    bindings: uid ? [{ event: "*", table: "crash_bets", filter: `user_id=eq.${uid}` }] : [],
    onEvent: () => qc.invalidateQueries({ queryKey: ["crash-stats-imperial"] }),
    enabled: !!uid,
  });

  const onPlace = async () => {
    if (betState !== "idle") return;
    setBetState("submitting");
    try {
      const auto = parseFloat(autoCashout);
      const autoNum = Number.isFinite(auto) && auto >= 1.01 ? auto : null;
      const r = await placeBet(bet, autoNum);
      lastRoundIdRef.current = r.round_id;
      setTicket({
        roundId: r.round_id,
        bet,
        autoCashout: autoNum,
        bonusMult: r.bonus_mult ?? 1,
        placedAt: Date.now(),
      });
      setBetState("placed");
      haptics.select();
      notify.success(`✅ 베팅 완료 · 보너스 ×${r.bonus_mult}`);
    } catch (e) {
      setBetState("idle");
      notify.error(friendlyError(e));
    }
  };

  const onCashout = async () => {
    if (!round.id || betState !== "placed") return;
    setBetState("cashing");
    try {
      const r = await cashoutNow(round.id);
      setBetState("paid");
      haptics.win();
      notify.success(`✨ +${r.payout.toLocaleString()} PHON · ${r.mult.toFixed(2)}x`);
      qc.invalidateQueries({ queryKey: ["crash-stats-imperial"] });
    } catch (e) {
      setBetState("placed");
      notify.error(friendlyError(e));
    }
  };

  const historyEntries = wins
    .slice(0, 24)
    .map((w, i) => ({ id: `${i}-${w.multiplier}`, multiplier: Number(w.multiplier) }));

  const multTone =
    mult >= 10 ? "text-[hsl(var(--pink))]" :
    mult >= 3 ? "text-orange-400" :
    "text-[hsl(var(--gold))]";

  const statusLabel =
    phase === "running" ? `${mult.toFixed(2)}x` :
    phase === "pending" ? "베팅 모집 중…" :
    phase === "crashed" ? "💥 폭발!" : "대기";

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-12">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {/* Header */}
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-[hsl(var(--gold))] to-[hsl(var(--pink))] flex items-center justify-center shrink-0 shadow-[0_0_24px_hsla(45,90%,55%,0.5)]">
              <Crown className="w-5 h-5 text-background" />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-black text-foreground flex items-center gap-2">
                Imperial Crash
                <Sparkles className="w-4 h-4 text-[hsl(var(--gold))]" />
              </h1>
              <p className="text-[11px] text-muted-foreground">황금 제국의 멀티플라이어 베팅</p>
            </div>
          </div>
          <Link
            to="/crash/history"
            className="h-11 px-3 rounded-xl bg-card border border-border/50 flex items-center gap-1.5 text-xs font-bold text-foreground hover:text-[hsl(var(--gold))]"
          >
            <History className="w-4 h-4" /> 내 기록
          </Link>
        </header>

        {/* History rail */}
        <ImperialHistory entries={historyEntries} />

        {/* Canvas + multiplier overlay */}
        <div className="relative">
          <ImperialCanvas multiplier={mult} phase={phase} />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <AnimatePresence mode="wait">
              <motion.div
                key={statusLabel}
                initial={{ scale: 0.94, opacity: 0.6 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
                className={`text-5xl md:text-7xl font-black tabular-nums drop-shadow-[0_0_28px_currentColor] ${multTone}`}
              >
                {statusLabel}
              </motion.div>
            </AnimatePresence>
          </div>
          {round.last_crash && phase === "pending" && (
            <div className="absolute top-3 right-3 text-xs text-muted-foreground bg-card/80 backdrop-blur px-2 py-1 rounded-md border border-border/30">
              직전:{" "}
              <span className={Number(round.last_crash) >= 2 ? "text-[hsl(var(--gold))] font-bold" : "text-destructive font-bold"}>
                {Number(round.last_crash).toFixed(2)}x
              </span>
            </div>
          )}
        </div>

        {/* Bet panel */}
        <ImperialBetPanel
          bet={bet}
          setBet={setBet}
          autoCashout={autoCashout}
          setAutoCashout={setAutoCashout}
          betState={betState}
          phase={phase}
          multiplier={mult}
          onPlace={onPlace}
          onCashout={onCashout}
        />

        {/* PF strip */}
        <div className="rounded-xl border border-border/40 bg-card/60 px-3 py-2 text-[11px] text-muted-foreground flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[hsl(var(--gold))]" />
            Provably Fair · commit→reveal
          </span>
          <span className="font-mono truncate max-w-[60%]">
            {pf.state.hash ? `hash ${pf.state.hash.slice(0, 12)}…` : "commit 대기"}
            {pf.state.seed ? ` · seed ${pf.state.seed.slice(0, 8)}…` : ""}
          </span>
        </div>

        {/* Recent wins */}
        <section className="rounded-2xl border border-border/60 bg-card p-4">
          <h2 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
            <Crown className="w-4 h-4 text-[hsl(var(--gold))]" /> 최근 황실 대박
          </h2>
          {wins.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">첫 대박의 주인공이 되어보세요.</p>
          ) : (
            <ul className="space-y-1.5 max-h-72 overflow-y-auto">
              {wins.map((w, i) => (
                <li key={i} className="flex items-center justify-between text-sm rounded-lg bg-background/40 px-3 py-2">
                  <span className="text-muted-foreground truncate">{w.nick}</span>
                  <span className="flex items-center gap-2 tabular-nums">
                    <span className={Number(w.multiplier) >= 10 ? "text-[hsl(var(--pink))] font-bold" : "text-[hsl(var(--gold))] font-bold"}>
                      {Number(w.multiplier).toFixed(2)}x
                    </span>
                    <span className="text-foreground font-black">+{Number(w.payout).toLocaleString()}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {stats && (
            <div className="mt-3 pt-3 border-t border-border/40 text-[11px] text-muted-foreground flex items-center justify-between">
              <span>내 연승: <span className="text-[hsl(var(--gold))] font-bold">×{stats.streak ?? 0}</span></span>
              <span>총 베팅: <span className="text-foreground font-bold tabular-nums">{(stats.total_bet ?? 0).toLocaleString()}</span></span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
