// PR-B Empire Hall — 2D Imperial Stage (Three.js 제거 후 대체).
// CSS 그라디언트 + framer-motion 회전 링 + 가벼운 SVG 성탑/배너.
// 모바일 발열 ZERO, 60fps, GPU 사용량 < 5%.
import { motion } from "framer-motion";

const TIER_HEX: Record<number, string> = {
  1: "#a1a1aa", 2: "#10b981", 3: "#0ea5e9", 4: "#6366f1", 5: "#a855f7",
  6: "#f59e0b", 7: "#ec4899", 8: "#d946ef", 9: "#38bdf8", 10: "#fbbf24",
};

interface Props {
  level: number;
  boosterActive: boolean;
}

export function EmpireHallScene({ level, boosterActive }: Props) {
  const lv = Math.max(1, Math.min(10, level));
  const color = TIER_HEX[lv];

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Sky gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, rgba(212,175,55,0.18) 0%, rgba(8,7,15,0.0) 55%), linear-gradient(180deg, #06050b 0%, #0a0810 60%, #06050b 100%)",
        }}
      />

      {/* Subtle starfield (CSS only, no JS animation) */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,.7) 50%, transparent 60%), radial-gradient(1px 1px at 70% 18%, rgba(255,255,255,.5) 50%, transparent 60%), radial-gradient(1.5px 1.5px at 45% 65%, rgba(212,175,55,.7) 50%, transparent 60%), radial-gradient(1px 1px at 82% 75%, rgba(255,255,255,.4) 50%, transparent 60%)",
          backgroundSize: "600px 600px",
        }}
      />

      {/* Center keep silhouette */}
      <svg
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMax meet"
        className="absolute inset-x-0 bottom-0 w-full h-[70%]"
        aria-hidden
      >
        <defs>
          <linearGradient id="keepGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3a3122" />
            <stop offset="100%" stopColor="#0c0905" />
          </linearGradient>
          <linearGradient id="bannerGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.95" />
            <stop offset="100%" stopColor={color} stopOpacity="0.45" />
          </linearGradient>
        </defs>
        {/* Towers */}
        <rect x="40"  y="160" width="40" height="120" fill="url(#keepGrad)" />
        <polygon points="40,160 60,130 80,160" fill="#181208" />
        <rect x="320" y="160" width="40" height="120" fill="url(#keepGrad)" />
        <polygon points="320,160 340,130 360,160" fill="#181208" />
        {/* Main keep */}
        <rect x="130" y="100" width="140" height="180" fill="url(#keepGrad)" />
        {/* Crenellation */}
        {[140, 160, 180, 200, 220, 240].map((x) => (
          <rect key={x} x={x} y="92" width="12" height="14" fill="#3a3122" />
        ))}
        {/* Door */}
        <rect x="184" y="210" width="32" height="70" fill="#0c0905" />
        {/* Banner pole */}
        <line x1="200" y1="40" x2="200" y2="100" stroke="#cbb472" strokeWidth="2" />
        {/* Banner (tier color) */}
        <rect x="200" y="48" width="46" height="34" fill="url(#bannerGrad)" />
      </svg>

      {/* Rotating crown halo (single transform, GPU-cheap) */}
      <motion.div
        className="absolute left-1/2 top-[28%] -translate-x-1/2 -translate-y-1/2"
        style={{ width: 220, height: 220 }}
        animate={{ rotate: 360 }}
        transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
      >
        <div
          className="w-full h-full rounded-full"
          style={{
            background: `conic-gradient(from 0deg, transparent 0%, ${color}55 18%, transparent 36%, ${color}33 60%, transparent 80%)`,
            filter: "blur(2px)",
          }}
        />
      </motion.div>

      {/* Booster halo */}
      {boosterActive && (
        <motion.div
          className="absolute left-1/2 top-[18%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-gold/70"
          style={{ width: 160, height: 160, boxShadow: "0 0 60px -8px rgba(245,158,11,0.55)" }}
          animate={{ scale: [1, 1.06, 1], opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* Soft floor glow */}
      <div
        className="absolute bottom-0 inset-x-0 h-1/3 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 100%, rgba(212,175,55,0.25) 0%, transparent 60%)",
        }}
      />
    </div>
  );
}

export default EmpireHallScene;
