import { Gem, Flame} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  streak: number;
  className?: string;
  size?: "sm" | "md";
}

/**
 * StreakFlame — 🔥 + 일수 칩.
 * Phase E Slice 4: Imperial Glow 강화.
 *   - 1~6일: muted
 *   - 7일+: amber pulse
 *   - 14일+: amber/rose gradient + ring pulse
 *   - 30일+: Imperial Half-Off gradient + 회전 corona + 우상단 💎
 * `prefers-reduced-motion` 에서 모든 모션 OFF (drop-shadow는 유지).
 */
export default function StreakFlame({ streak, className, size = "md" }: Props) {
  if (!streak || streak < 1) return null;
  const hot = streak >= 7;
  const epic = streak >= 14;
  const imperial = streak >= 30;
  const px = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";

  const tone = imperial
    ? "text-amber-100 border border-amber-300/50"
    : epic
      ? "bg-gradient-to-r from-amber-500/30 to-rose-500/30 text-amber-100 border border-amber-400/40 motion-safe:animate-pulse"
      : hot
        ? "bg-amber-500/20 text-amber-200 border border-amber-400/30 motion-safe:animate-pulse"
        : "bg-muted/40 text-muted-foreground border border-border/40";

  const imperialBg = imperial
    ? "bg-[linear-gradient(100deg,hsl(38_92%_55%)_0%_50%,hsl(330_85%_60%)_50%_100%)]"
    : "";

  return (
    <span
      title={`${streak}일 연속 출석 — 폐하의 불꽃`}
      style={{ contain: "layout paint" }}
      className={cn(
        "relative inline-flex items-center gap-1 rounded-full font-black tabular-nums will-change-transform",
        px,
        tone,
        imperialBg,
        imperial && "shadow-[0_8px_24px_-10px_hsl(38_92%_55%/0.55),0_0_0_1px_hsl(330_85%_60%/0.35)_inset]",
        className,
      )}
    >
      {imperial && (
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-1.5 rounded-full motion-safe:animate-[spin_6s_linear_infinite]"
          style={{
            background:
              "conic-gradient(from 0deg, hsl(38 92% 60% / 0.55), hsl(330 85% 65% / 0.0) 25%, hsl(38 92% 60% / 0.55) 50%, hsl(330 85% 65% / 0.0) 75%, hsl(38 92% 60% / 0.55))",
            WebkitMask:
              "radial-gradient(transparent 58%, #000 62%)",
            mask: "radial-gradient(transparent 58%, #000 62%)",
          }}
        />
      )}
      <Flame
        className={cn(
          "relative z-10",
          size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5",
          hot && "drop-shadow-[0_0_4px_hsl(38_92%_55%/0.7)]",
        )}
      />
      <span className="relative z-10">{streak}일</span>
      {imperial && (
        <Gem className="relative z-10 w-3 h-3 text-amber-100 drop-shadow-[0_0_3px_hsl(330_85%_60%/0.8)]" />
      )}
    </span>
  );
}
