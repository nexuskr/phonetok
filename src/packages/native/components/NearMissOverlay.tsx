/**
 * Phase 4 Sprint 3 — Near-Miss Overlay
 * -------------------------------------
 * Sprint 2 cosmetic worker 와 자연스럽게 연결.
 * Worker 실패/저사양/timeout 시 main-thread fallback (cosmetic.ts 내부 처리).
 * transform + opacity only. 60fps.
 *
 * 사용:
 *   <NearMissOverlay reels={[7,7,3]} />  // 0..1 intensity 시각화
 */
import { useEffect, useState } from "react";
import { calcNearMiss } from "@/packages/workers/cosmetic";

type Props = {
  reels: number[];
  durationMs?: number;
};

export function NearMissOverlay({ reels, durationMs = 900 }: Props) {
  const [score, setScore] = useState(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let hideT: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      const s = await calcNearMiss(reels);
      if (cancelled) return;
      setScore(s);
      if (s >= 0.5) {
        setShow(true);
        hideT = setTimeout(() => setShow(false), durationMs);
      }
    })();
    return () => {
      cancelled = true;
      if (hideT) clearTimeout(hideT);
    };
  }, [reels, durationMs]);

  if (!show) return null;
  const scale = 1 + score * 0.15;
  const opacity = 0.25 + score * 0.55;
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        transform: `translate3d(0,0,0) scale(${scale})`,
        opacity,
        transition: `transform ${durationMs}ms cubic-bezier(.2,.8,.2,1), opacity ${durationMs}ms ease-out`,
        willChange: "transform, opacity",
        background:
          "radial-gradient(circle at 50% 50%, rgba(245,158,11,0.35) 0%, rgba(245,158,11,0) 65%)",
        mixBlendMode: "screen",
      }}
    />
  );
}

export default NearMissOverlay;
