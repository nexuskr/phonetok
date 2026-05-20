import { useOnline, useTodayPayout } from "@/components/LiveStats";
import { Gem, Sparkles, Users, TrendingUp} from "lucide-react";
import { motion } from "framer-motion";
import { SimChip } from "@/components/sim/SimChip";
import { useEmpireBooster } from "@/hooks/use-empire-booster";

/**
 * Empire Population Pulse — compact live strip.
 * PR-12: Baron+ 본인이 활성 Empire Booster를 보유한 경우 골드 글로우 밴드 + 회전 코로나 적용.
 */
export default function EmpirePopulationPulse() {
  const online = useOnline();
  const today = useTodayPayout();
  const { active } = useEmpireBooster();
  const todayCoin = Math.round(today / 1_000);

  return (
    <div
      className={`relative w-full px-3 sm:px-4 py-1.5 border-y backdrop-blur transition-colors ${
        active
          ? "border-sim-gold/60 bg-gradient-to-r from-amber-900/20 via-sim-gold/10 to-amber-900/20"
          : "border-sim-gold/20 bg-gradient-to-r from-sim-gold/10 via-transparent to-sim-gold/10"
      }`}
    >
      {/* Baron+ 활성 시 골드 스윕 효과 */}
      {active && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -inset-x-10"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(251,191,36,0.15) 35%, rgba(251,191,36,0.35) 50%, rgba(251,191,36,0.15) 65%, transparent 100%)",
            mixBlendMode: "screen",
          }}
          animate={{ x: ["-20%", "20%"] }}
          transition={{ duration: 6, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" }}
        />
      )}
      <div className="relative max-w-6xl mx-auto flex items-center gap-3 text-[11px] sm:text-xs">
        <SimChip />
        {active && (
          <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sim-gold/20 border border-sim-gold/40 text-sim-gold font-bold tracking-wider">
            <Gem className="w-3 h-3" /> BARON
          </span>
        )}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="relative flex h-2 w-2 shrink-0">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${
                active ? "bg-sim-gold" : "bg-secondary"
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${active ? "bg-sim-gold" : "bg-secondary"}`}
            />
          </span>
          <Users className="w-3 h-3 text-sim-gold shrink-0" />
          <span className="font-bold text-foreground tabular-nums">{online.toLocaleString()}</span>
          <span className="text-muted-foreground truncate">활성 제국민 (시뮬)</span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 ml-auto">
          <TrendingUp className="w-3 h-3 text-sim-gold" />
          <span className="font-bold text-sim-gold tabular-nums">{todayCoin.toLocaleString()} ₡</span>
          <span className="text-muted-foreground">오늘 시뮬 지급</span>
        </div>
        <div className="flex sm:hidden items-center gap-1 ml-auto">
          <Sparkles className="w-3 h-3 text-sim-gold" />
          <span className="text-muted-foreground">실시간</span>
        </div>
      </div>
    </div>
  );
}
