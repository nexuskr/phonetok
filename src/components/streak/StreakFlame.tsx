import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  streak: number;
  className?: string;
  size?: "sm" | "md";
}

/**
 * StreakFlame — 🔥 + 일수 칩. 7일+ 펄스. Tier별 색은 부모가 결정.
 */
export default function StreakFlame({ streak, className, size = "md" }: Props) {
  if (!streak || streak < 1) return null;
  const hot = streak >= 7;
  const epic = streak >= 30;
  const px = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs";
  return (
    <span
      title={`${streak}일 연속 출석 — 폐하의 불꽃`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-black tabular-nums",
        px,
        epic
          ? "bg-gradient-to-r from-amber-500/30 to-rose-500/30 text-amber-200 border border-amber-400/40"
          : hot
          ? "bg-amber-500/20 text-amber-300 border border-amber-400/30"
          : "bg-muted/40 text-muted-foreground border border-border/40",
        hot && "animate-pulse",
        className,
      )}
    >
      <Flame className={cn(size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5", hot && "drop-shadow-[0_0_4px_rgba(251,191,36,0.6)]")} />
      {streak}일
    </span>
  );
}
