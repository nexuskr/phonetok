import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function GlowCard({
  children, className, glow = "neon", hover = true,
}: { children: ReactNode; className?: string; glow?: "neon" | "magenta"; hover?: boolean }) {
  return (
    <div
      className={cn(
        "relative rounded-2xl p-[1.5px] overflow-hidden",
        "bg-[conic-gradient(from_0deg_at_50%_50%,hsl(var(--apex-neon)/0.55),hsl(var(--apex-magenta)/0.55),hsl(var(--apex-cyan)/0.55),hsl(var(--apex-neon)/0.55))]",
        "before:absolute before:inset-[-50%] before:rounded-full before:bg-[conic-gradient(from_0deg_at_50%_50%,transparent,hsl(var(--apex-neon)/0.9),transparent_30%)] before:animate-[apex-spin_6s_linear_infinite] before:opacity-60",
        hover && "transition-transform hover:scale-[1.015] hover:before:opacity-100",
        className,
      )}
    >
      <div className={cn(
        "relative apex-glass rounded-2xl h-full w-full overflow-hidden",
        glow === "magenta" && "apex-glow-magenta",
      )}>
        {children}
      </div>
      <style>{`@keyframes apex-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
