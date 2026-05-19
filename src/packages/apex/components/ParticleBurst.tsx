import { useEffect, useState } from "react";

/** ParticleBurst — fires confetti + radial ring when `trigger` increments. */
export function ParticleBurst({ trigger, intensity = 1 }: { trigger: number; intensity?: number }) {
  const [ringKey, setRingKey] = useState(0);
  useEffect(() => {
    if (!trigger) return;
    setRingKey((k) => k + 1);
    let cancelled = false;
    import("canvas-confetti").then((m) => {
      if (cancelled) return;
      const confetti = m.default;
      confetti({
        particleCount: Math.floor(110 * intensity), spread: 80, startVelocity: 55,
        origin: { y: 0.55 }, colors: ["#00FF9F", "#FF00FF", "#00E5FF", "#FFD700"], scalar: 1.05,
      });
      setTimeout(() => confetti({
        particleCount: Math.floor(60 * intensity), angle: 60, spread: 70, origin: { x: 0, y: 0.7 },
        colors: ["#00FF9F", "#00E5FF"],
      }), 120);
      setTimeout(() => confetti({
        particleCount: Math.floor(60 * intensity), angle: 120, spread: 70, origin: { x: 1, y: 0.7 },
        colors: ["#FF00FF", "#FFD700"],
      }), 180);
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);
  if (!ringKey) return null;
  return (
    <div key={ringKey} aria-hidden className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center">
      <div className="w-32 h-32 rounded-full border-4 border-primary/80 animate-[apex-ring_1.2s_ease-out_forwards]" />
      <style>{`@keyframes apex-ring { 0% { transform: scale(0.3); opacity: 1; } 100% { transform: scale(8); opacity: 0; } }`}</style>
    </div>
  );
}
