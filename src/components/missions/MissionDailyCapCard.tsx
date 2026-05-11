import { useEffect, useState } from "react";
import { Clock, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Tier } from "@/lib/store";

interface Props {
  playsUsed: number;
  playLimit: number;
  tier: Tier;
}

/**
 * 미션 일일 한도 카드 — 20~70대 가시화 친화.
 * 풀폭 진행 바 + 다음 리셋 카운트다운 + 한도 도달 시 강조.
 */
export default function MissionDailyCapCard({ playsUsed, playLimit, tier }: Props) {
  const { t } = useTranslation("missions");
  const left = Math.max(0, playLimit - playsUsed);
  const pct = Math.min(100, Math.round((playsUsed / Math.max(1, playLimit)) * 100));
  const reached = left === 0;
  const [countdown, setCountdown] = useState(getResetCountdown());

  useEffect(() => {
    const i = setInterval(() => setCountdown(getResetCountdown()), 1000);
    return () => clearInterval(i);
  }, []);

  return (
    <div
      className={`relative rounded-2xl p-4 mb-4 overflow-hidden border ${
        reached
          ? "bg-destructive/10 border-destructive/40"
          : "glass-strong border-primary/20"
      }`}
    >
      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-primary opacity-15 blur-2xl pointer-events-none" />
      <div className="relative flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] tracking-widest font-black uppercase text-muted-foreground">
            <Zap className="w-3 h-3 text-primary" /> 오늘 미션 한도 · {tier}
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={`font-display font-black text-2xl tabular-nums ${reached ? "text-destructive" : "text-gradient-primary"}`}>
              {playsUsed}
            </span>
            <span className="text-sm text-muted-foreground tabular-nums">/ {playLimit}회</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] tracking-widest font-black uppercase text-muted-foreground flex items-center justify-end gap-1">
            <Clock className="w-3 h-3" /> 자정 리셋
          </div>
          <div className="text-sm font-display font-black tabular-nums mt-1">{countdown}</div>
        </div>
      </div>

      <div className="relative h-2.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${
            reached
              ? "bg-gradient-to-r from-destructive to-rose-500"
              : "bg-gradient-to-r from-primary via-secondary to-gold"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">
          {reached ? "오늘 한도를 모두 사용했어요" : <>남은 횟수 <span className="font-black text-foreground tabular-nums">{left}회</span></>}
        </span>
        {!reached && playsUsed > 0 && (
          <span className="text-secondary font-bold">
            진행률 {pct}%
          </span>
        )}
      </div>
    </div>
  );
}

function getResetCountdown() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  const diff = Math.max(0, next.getTime() - now.getTime());
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
