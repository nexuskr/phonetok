// DevWinCheats — DEV 빌드에서만 렌더되는 Win Celebration 트리거 패널.
// production 빌드에서는 import.meta.env.DEV === false 이므로 트리 셰이킹 + 런타임 가드로 0 렌더.
// 실제 베팅 미발생 — WinCelebrationManager 직접 호출만.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { WinCelebrationManager } from "@/lib/celebration/WinCelebrationManager";
import { Bug, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  themeKey?: string;
  unitLabel?: string;
  /** theme.maxMultiplier — MAX 버튼이 트리거할 배율 (기본 5000) */
  maxMultiplier?: number;
}

const TIERS: Array<{ label: string; mult: number; tone: string }> = [
  { label: "BIG ×60", mult: 60, tone: "bg-amber-600 hover:bg-amber-500" },
  { label: "MEGA ×200", mult: 200, tone: "bg-orange-600 hover:bg-orange-500" },
  { label: "EPIC ×700", mult: 700, tone: "bg-pink-600 hover:bg-pink-500" },
  { label: "LEGENDARY ×2000", mult: 2000, tone: "bg-fuchsia-600 hover:bg-fuchsia-500" },
];

export default function DevWinCheats({
  themeKey = "cosmic",
  unitLabel = "DEMO 칩",
  maxMultiplier = 5000,
}: Props) {
  const [open, setOpen] = useState(false);

  if (!import.meta.env.DEV) return null;

  const fire = (mult: number) => {
    const fakeBet = 100;
    WinCelebrationManager.triggerWin(mult, mult * fakeBet, { themeKey, unitLabel });
  };

  return (
    <div className="fixed bottom-4 right-4 z-[150] select-none">
      {open ? (
        <div className="rounded-xl border border-violet-400/50 bg-slate-950/90 backdrop-blur-md shadow-2xl p-3 w-56 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-200">
              <Bug className="h-3.5 w-3.5" />
              DEV — Win Cheats
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-violet-300 hover:text-violet-100"
              aria-label="닫기"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {TIERS.map((t) => (
              <Button
                key={t.label}
                size="sm"
                className={`${t.tone} text-white text-xs h-8`}
                onClick={() => fire(t.mult)}
              >
                {t.label}
              </Button>
            ))}
            <Button
              size="sm"
              className="bg-gradient-to-r from-fuchsia-600 via-yellow-500 to-cyan-500 text-white text-xs h-9 font-extrabold tracking-wide"
              onClick={() => fire(maxMultiplier)}
            >
              MAX ×{maxMultiplier.toLocaleString()}
            </Button>
          </div>
          <p className="text-[10px] text-violet-300/70 leading-tight">
            DEV 전용 — 실제 베팅 미발생. production 자동 숨김.
          </p>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="rounded-full bg-violet-700/90 hover:bg-violet-600 text-white shadow-xl px-3 py-2 flex items-center gap-1.5 text-xs font-semibold backdrop-blur-md"
          aria-label="Dev Win Cheats 열기"
        >
          <Bug className="h-3.5 w-3.5" />
          Cheats
          <ChevronUp className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
