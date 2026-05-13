/**
 * SimGlobalBadge — 모든 화면 우상단에 항상 노출되는 "Simulation Active SIM" 칩.
 * Practice Mode가 ON이거나, /wallet/withdraw 외 모든 SIM 영역에 강제 표시.
 * 법적 안전 우선: 사용자가 "실제 수익"으로 오인하지 않도록 영구 고정.
 */
import { useEffect, useState } from "react";
import { isPracticeMode } from "@/lib/practiceMode";

export default function SimGlobalBadge() {
  const [practice, setPractice] = useState<boolean>(() => isPracticeMode());

  useEffect(() => {
    const h = (e: Event) => setPractice(!!(e as CustomEvent).detail);
    window.addEventListener("pm:practice-mode-change", h as EventListener);
    return () => window.removeEventListener("pm:practice-mode-change", h as EventListener);
  }, []);

  // 항상 표시 (Practice 여부와 무관). Practice 시 강조.
  return (
    <div
      role="status"
      aria-label="Simulation Active"
      className="fixed top-2 right-2 z-[80] pointer-events-none select-none"
    >
      <div
        className={
          "px-2.5 py-1 rounded-full text-[10px] font-black tracking-[0.18em] uppercase border backdrop-blur-md " +
          (practice
            ? "bg-amber-500/20 text-amber-200 border-amber-400/60 shadow-[0_0_18px_-4px_rgba(245,158,11,0.6)]"
            : "bg-background/70 text-muted-foreground border-border/60")
        }
      >
        <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle bg-amber-400 animate-pulse" />
        Simulation Active · SIM
      </div>
    </div>
  );
}
