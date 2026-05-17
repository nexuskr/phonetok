import { motion } from "framer-motion";
import { CalendarCheck, Check } from "lucide-react";

interface Props {
  days: number;
  claimedToday: boolean;
  nextReward: number;
  onClaim: () => void;
}

export default function StreakCard({ days, claimedToday, nextReward, onClaim }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="imperial-card imperial-card-hover imperial-corner-shine relative overflow-hidden p-5 flex flex-col gap-4 will-change-transform"
    >
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/25 to-pink/15 text-primary flex items-center justify-center ring-1 ring-primary/30">
            <CalendarCheck className="w-5 h-5" />
          </span>
          <div>
            <div className="text-base font-bold text-foreground">출석체크</div>
            <div className="text-xs text-muted-foreground">7일 연속이면 1,500 PHON</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-muted-foreground">오늘 받을 보상</div>
          <div className="text-lg font-black imperial-halfoff-text">
            +{nextReward.toLocaleString()}
          </div>
        </div>
      </header>

      <div className="flex items-center gap-1.5">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className={`flex-1 h-2.5 rounded-full transition-colors ${
              i < days
                ? "bg-gradient-to-r from-primary to-pink"
                : "bg-muted/40"
            }`}
            aria-label={`D${i + 1}`}
          />
        ))}
      </div>

      <button
        onClick={onClaim}
        disabled={claimedToday}
        className="min-h-12 rounded-xl font-bold text-base bg-gradient-to-r from-primary to-pink text-primary-foreground disabled:from-muted/40 disabled:to-muted/40 disabled:text-muted-foreground transition active:scale-[0.98] will-change-transform"
      >
        {claimedToday ? (
          <span className="inline-flex items-center gap-1.5">
            <Check className="w-4 h-4" /> 오늘 출석 완료
          </span>
        ) : (
          `+${nextReward.toLocaleString()} PHON 받기`
        )}
      </button>
    </motion.div>
  );
}
