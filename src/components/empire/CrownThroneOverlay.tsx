/**
 * Crown War HUD v2 — 황제 교체 처형식 오버레이.
 * 실시간으로 Top 1 (황제)이 바뀌면 3.2초간 전체 화면 드라마틱 연출.
 * 마운트는 Layout 단일.
 *
 * 로직:
 *  - useCrownWar 훅의 leaderboard[0]를 watch
 *  - 직전 닉이 다른 닉으로 바뀌면 fire
 *  - 같은 사람이 계속 1위면 발동 안 함
 *  - 첫 마운트(직전값 없음)에서는 발동 안 함
 */
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Crown, Swords } from "lucide-react";
import { useCrownWar } from "@/hooks/use-crown-war";

export default function CrownThroneOverlay() {
  const { snap } = useCrownWar(15000);
  const [event, setEvent] = useState<{ from: string | null; to: string; meIsNew: boolean } | null>(null);
  const lastEmperor = useRef<string | null>(null);
  const seeded = useRef(false);

  useEffect(() => {
    const top = snap?.leaderboard?.[0];
    if (!top || !snap?.war || snap.war.status !== "active") return;
    const nick = top.nick;
    if (!seeded.current) {
      lastEmperor.current = nick;
      seeded.current = true;
      return;
    }
    if (lastEmperor.current && lastEmperor.current !== nick) {
      setEvent({ from: lastEmperor.current, to: nick, meIsNew: !!top.is_me });
      const t = window.setTimeout(() => setEvent(null), 3200);
      lastEmperor.current = nick;
      return () => window.clearTimeout(t);
    }
    lastEmperor.current = nick;
  }, [snap?.leaderboard, snap?.war]);

  return (
    <AnimatePresence>
      {event && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] flex items-center justify-center pointer-events-none"
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          {/* Sweep */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-400/30 to-transparent"
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{ duration: 1.6, ease: "easeOut" }}
          />
          {/* Particles */}
          {Array.from({ length: 22 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_14px_hsl(45_100%_60%)]"
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0, 1.4, 0],
                x: Math.cos((i / 22) * Math.PI * 2) * (180 + Math.random() * 240),
                y: Math.sin((i / 22) * Math.PI * 2) * (180 + Math.random() * 240),
              }}
              transition={{ duration: 2.2, ease: "easeOut", delay: 0.1 }}
            />
          ))}
          {/* Card */}
          <motion.div
            initial={{ scale: 0.5, y: 40, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="relative z-10 max-w-md w-[90%] mx-auto"
          >
            <div className="relative px-6 py-7 rounded-3xl border-2 border-amber-300/70 bg-gradient-to-br from-amber-500/20 via-background/95 to-yellow-600/20 backdrop-blur-xl shadow-[0_0_80px_hsl(45_100%_55%/0.7)]">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-amber-400 text-black text-[10px] font-black tracking-[0.35em]">
                THRONE TAKEN
              </div>
              <div className="flex items-center justify-center gap-3">
                <motion.div
                  animate={{ rotate: [0, -10, 10, -6, 6, 0], scale: [1, 1.15, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                  className="h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-300 to-amber-600 text-black flex items-center justify-center shadow-[0_0_30px_hsl(45_100%_55%/0.7)]"
                >
                  <Crown className="h-7 w-7" />
                </motion.div>
                <Swords className="h-5 w-5 text-rose-400" />
              </div>
              <div className="mt-4 text-center">
                <div className="text-[10px] tracking-[0.35em] text-muted-foreground">EMPEROR CHANGED</div>
                <div className="mt-1 text-2xl font-black tracking-tight bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-300 bg-clip-text text-transparent">
                  {event.meIsNew ? "당신이 제국을 정복했다" : `${event.to} 가(이) 왕좌를 차지했다`}
                </div>
                {event.from && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    이전 황제: <span className="font-mono">{event.from}</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
