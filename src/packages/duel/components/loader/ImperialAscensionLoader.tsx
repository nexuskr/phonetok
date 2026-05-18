/**
 * ImperialAscensionLoader — "황제의 입궁" 풀스크린 시네마틱 로딩.
 * /duel 진입 직전 1.9~2.3s 재생. transform/opacity only, 60fps, GPU layered.
 * canvas-confetti lazy(기존 청크 재사용). prefers-reduced-motion 자동 단순화.
 */
import { useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown } from "lucide-react";

interface Props {
  open: boolean;
  onDone: () => void;
  /** 자동 종료 시간 ms (기본 2200). */
  durationMs?: number;
}

const REDUCED =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function ImperialAscensionLoader({
  open,
  onDone,
  durationMs = 2200,
}: Props) {
  const doneRef = useRef(false);

  // Auto-dismiss + 3-stage confetti bursts
  useEffect(() => {
    if (!open) {
      doneRef.current = false;
      return;
    }
    let cancelled = false;
    const timers: number[] = [];

    const fire = (delay: number, n: number) =>
      timers.push(
        window.setTimeout(async () => {
          if (cancelled || REDUCED) return;
          try {
            const mod = await import("canvas-confetti");
            if (cancelled) return;
            mod.default({
              particleCount: n,
              spread: 90,
              startVelocity: 55,
              origin: { y: 0.42, x: 0.5 },
              colors: ["#F5C518", "#FFD86B", "#F472B6", "#EC4899", "#FFF7C2"],
              scalar: 1.05,
              ticks: 200,
            });
          } catch {
            /* noop */
          }
        }, delay),
      );

    fire(500, 60);
    fire(900, 90);
    fire(1400, 50);

    timers.push(
      window.setTimeout(() => {
        if (cancelled || doneRef.current) return;
        doneRef.current = true;
        onDone();
      }, durationMs),
    );

    return () => {
      cancelled = true;
      timers.forEach(window.clearTimeout);
    };
  }, [open, durationMs, onDone]);

  const skip = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  // Crown particle ring positions (14 satellites)
  const satellites = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2;
        return { x: Math.cos(a) * 130, y: Math.sin(a) * 130, delay: i * 0.06 };
      }),
    [],
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="ascension"
          role="dialog"
          aria-label="황실 입장 중"
          onClick={skip}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
          className="fixed inset-0 z-[100] cursor-pointer overflow-hidden bg-[#070302]"
          style={{ willChange: "opacity" }}
        >
          {/* Ambient 3-layer radial gradient */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(40% 35% at 50% 45%, hsl(45 95% 55% / 0.55), transparent 70%), radial-gradient(70% 60% at 50% 55%, hsl(330 90% 55% / 0.42), transparent 75%), radial-gradient(100% 100% at 50% 60%, hsl(30 80% 30% / 0.35), transparent 85%)",
            }}
          />

          {/* Divine vertical light ray */}
          {!REDUCED && (
            <motion.div
              className="absolute left-1/2 top-0 bottom-0 w-[42vw] -translate-x-1/2 pointer-events-none mix-blend-screen"
              initial={{ scaleY: 0, opacity: 0 }}
              animate={{ scaleY: 1, opacity: 0.85 }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.2, 0.7, 0.2, 1] }}
              style={{
                transformOrigin: "50% 50%",
                background:
                  "linear-gradient(180deg, transparent 0%, hsl(45 95% 70% / 0.35) 35%, hsl(330 90% 65% / 0.4) 55%, transparent 100%)",
                filter: "blur(8px)",
                willChange: "transform, opacity",
              }}
            />
          )}

          {/* Crown stage */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="relative" style={{ width: 320, height: 320 }}>
              {/* Hot pink outer pulse ring */}
              {!REDUCED && (
                <motion.div
                  className="absolute inset-0 rounded-full"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: [0, 0.9, 0.5, 0.9], scale: [0.6, 1.05, 1, 1.08] }}
                  transition={{ duration: 1.8, times: [0, 0.3, 0.6, 1], ease: "easeOut" }}
                  style={{
                    background:
                      "conic-gradient(from 90deg, #F5C518, #F472B6, #FFD86B, #EC4899, #F5C518)",
                    filter: "blur(2px)",
                    boxShadow:
                      "0 0 80px hsl(330 90% 60% / 0.7), 0 0 160px hsl(38 92% 60% / 0.5)",
                    willChange: "transform, opacity",
                  }}
                />
              )}

              {/* Inner dark disk */}
              <div
                className="absolute inset-3 rounded-full bg-[#0A0503]"
                style={{ boxShadow: "inset 0 0 28px hsl(38 92% 60% / 0.5)" }}
              />

              {/* Crown satellite ring */}
              {!REDUCED &&
                satellites.map((s, i) => (
                  <motion.div
                    key={i}
                    className="absolute left-1/2 top-1/2"
                    initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
                    animate={{
                      opacity: [0, 1, 0.85],
                      x: s.x,
                      y: s.y,
                      scale: 1,
                    }}
                    transition={{
                      duration: 0.9,
                      delay: 0.3 + s.delay,
                      ease: [0.2, 0.7, 0.2, 1],
                    }}
                    style={{ willChange: "transform, opacity" }}
                  >
                    <Crown
                      className="w-4 h-4 text-amber-300 -translate-x-1/2 -translate-y-1/2"
                      strokeWidth={1.4}
                      style={{
                        filter: "drop-shadow(0 0 8px hsl(45 95% 65% / 0.9))",
                      }}
                    />
                  </motion.div>
                ))}

              {/* Main crown */}
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
                initial={{ scale: REDUCED ? 1 : 0.6, rotate: REDUCED ? 0 : -8, opacity: 0 }}
                animate={{ scale: 1, rotate: REDUCED ? 0 : 14, opacity: 1 }}
                transition={
                  REDUCED
                    ? { duration: 0.3 }
                    : { type: "spring", stiffness: 220, damping: 16, delay: 0.15 }
                }
                style={{ willChange: "transform, opacity" }}
              >
                <Crown
                  className="w-32 h-32 md:w-40 md:h-40 text-amber-200"
                  strokeWidth={1.1}
                  style={{
                    filter:
                      "drop-shadow(0 0 18px hsl(45 95% 65% / 0.95)) drop-shadow(0 0 36px hsl(38 92% 55% / 0.7)) drop-shadow(0 0 64px hsl(330 90% 60% / 0.55))",
                  }}
                />
              </motion.div>

              {/* Imperial Seal Burst (0.9s) */}
              {!REDUCED && (
                <motion.div
                  className="absolute inset-0 rounded-full pointer-events-none mix-blend-screen"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: [0, 1.4, 1.05], opacity: [0, 0.9, 0] }}
                  transition={{ duration: 1.1, delay: 0.9, ease: "easeOut" }}
                  style={{
                    background:
                      "radial-gradient(circle, hsl(45 95% 70% / 0.95) 0%, hsl(330 90% 65% / 0.55) 45%, transparent 70%)",
                    willChange: "transform, opacity",
                  }}
                />
              )}
            </div>

            {/* Title */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
              className="mt-8 px-6 text-center"
              style={{ willChange: "transform, opacity" }}
            >
              <div
                className="font-imperial text-amber-100"
                style={{
                  fontSize: "clamp(2.8rem, 9vw, 5.2rem)",
                  letterSpacing: "0.12em",
                  lineHeight: 1,
                  textShadow:
                    "0 0 18px hsl(45 95% 65% / 0.85), 0 0 36px hsl(38 92% 60% / 0.6), 0 0 64px hsl(330 90% 60% / 0.5)",
                }}
              >
                황제의 대관전
              </div>
              <div className="mt-2 text-[10px] tracking-[0.42em] font-black uppercase text-pink-300/90"
                   style={{ textShadow: "0 0 12px hsl(330 90% 60% / 0.7)" }}>
                Imperial · Ascension
              </div>
            </motion.div>

            {/* Progress Ring */}
            <div className="relative mt-7" style={{ width: 64, height: 64 }}>
              <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="hsl(45 95% 65% / 0.18)"
                  strokeWidth="2"
                  fill="none"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="url(#ascend-grad)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray="176"
                  style={{
                    animation: REDUCED
                      ? "ascend-ring-static 0.01s linear forwards"
                      : `ascend-ring ${durationMs}ms linear forwards`,
                    filter: "drop-shadow(0 0 6px hsl(330 90% 60% / 0.8))",
                  }}
                />
                <defs>
                  <linearGradient id="ascend-grad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#F5C518" />
                    <stop offset="100%" stopColor="#F472B6" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            {/* Subtitle */}
            <div
              className="mt-3 text-sm font-semibold text-amber-200/90"
              style={{
                animation: REDUCED ? undefined : "ascend-breathe 1.4s ease-in-out infinite",
                textShadow: "0 0 10px hsl(45 95% 65% / 0.55)",
              }}
            >
              황실 입장 중…
            </div>
          </div>

          <style>{`
            @keyframes ascend-ring { from { stroke-dashoffset: 176; } to { stroke-dashoffset: 0; } }
            @keyframes ascend-ring-static { to { stroke-dashoffset: 0; } }
            @keyframes ascend-breathe { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
