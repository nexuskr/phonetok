// OlympusLegacyMaxWinOverlay — 5000× Hollywood-cinematic, "Warm Olympus Luxury".
// Built on BaseMaxWinOverlay (same screen-shake / slow-mo / sound facade pipeline
// the other Signature Slots use). Visual identity: warm amber gold only, no cold
// blue. Crown award at ≥4000× is delegated to onMaxWinTriggered (idempotent
// dedupe by spinId is enforced inside SlotSignatureWrapper → useEmpireCrown).
import { Crown } from "lucide-react";
import BaseMaxWinOverlay, {
  type MaxWinTriggeredPayload,
} from "@/components/celebration/BaseMaxWinOverlay";

interface Props {
  triggerAt?: number;
  durationMs?: number;
  onMaxWinTriggered?: (payload: MaxWinTriggeredPayload) => void;
  slotId?: string;
  themeKey?: string;
}

// Warm-amber palette (no cold blue accents anywhere)
const AMBER_PALETTE = {
  backdrop:
    "radial-gradient(circle at 50% 55%, rgba(255,196,90,0.42) 0%, rgba(180,120,40,0.22) 38%, rgba(7,12,28,0.86) 100%)",
  flareLeft:
    "linear-gradient(90deg, rgba(255,196,90,0.75) 0%, rgba(255,196,90,0) 100%)",
  flareRight:
    "linear-gradient(270deg, rgba(255,170,60,0.75) 0%, rgba(255,170,60,0) 100%)",
  // warm-amber confetti only — soft marble white as the highlight accent
  confettiColors: [
    "#ffd27a", "#ffb347", "#f5e8cd",
    "#ffc46a", "#e0a04a", "#fff1c8",
  ],
  titleGradientClass: "bg-gradient-to-b from-amber-100 via-yellow-300 to-amber-500",
  titleGlow: "drop-shadow(0 0 26px rgba(255,196,90,0.95))",
  multiplierTextClass: "text-amber-100",
  multiplierTextShadow: "0 0 14px rgba(255,196,90,0.85)",
  subTextClass: "text-amber-200",
};

export default function OlympusLegacyMaxWinOverlay({
  triggerAt = 5000,
  durationMs = 3400,
  onMaxWinTriggered,
  slotId,
  themeKey,
}: Props) {
  return (
    <BaseMaxWinOverlay
      triggerAt={triggerAt}
      durationMs={durationMs}
      onMaxWinTriggered={onMaxWinTriggered}
      slotId={slotId}
      themeKey={themeKey}
      ariaLabel="Olympus Legacy Max Win"
      // Reuse olympus voice/sfx pack (see soundConfig.SLOT_SOUND_MAP.olympus_legacy)
      soundKeys={{ primary: "legendary_win", voice: "zeus_decree" }}
      titleText="OLYMPUS LEGACY"
      icon={
        <Crown
          className="h-20 w-20 sm:h-28 sm:w-28 text-amber-200 mb-3"
          style={{
            willChange: "transform, filter",
            filter:
              "drop-shadow(0 0 32px rgba(255,196,90,0.95)) drop-shadow(0 0 64px rgba(255,170,60,0.6))",
          }}
        />
      }
      palette={AMBER_PALETTE}
      // 3-burst golden confetti (BaseMaxWinOverlay auto-throttles on mobile)
      confettiBursts={[
        { delay: 0,    originY: 0.5,  scalar: 1.5, spread: 120, startVelocity: 65 },
        { delay: 420,  originY: 0.32, scalar: 1.4, spread: 120, startVelocity: 60 },
        { delay: 900,  originY: 0.6,  scalar: 1.4, spread: 120, startVelocity: 60 },
        { delay: 1320, originY: 0.45, scalar: 1.3, spread: 130, startVelocity: 55 },
      ]}
      cinematic={() => (
        // Zeus silhouette + warm radial halo (GPU composite-only).
        // No JS animation loop — pure CSS keyframes fade-in.
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-end justify-center overflow-hidden"
          style={{ willChange: "opacity, transform" }}
        >
          {/* warm marble halo behind silhouette */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 50% 85%, rgba(255,210,120,0.45) 0%, rgba(255,170,60,0.18) 35%, transparent 70%)",
              animation: "olympus-halo-pulse 1.6s ease-out forwards",
            }}
          />
          {/* Zeus silhouette — SVG, fades in from below */}
          <svg
            viewBox="0 0 240 280"
            className="relative w-[68%] max-w-[520px] h-auto opacity-0"
            style={{
              animation: "olympus-zeus-in 1.2s 0.35s cubic-bezier(.16,.84,.36,1) forwards",
              filter: "drop-shadow(0 0 40px rgba(255,196,90,0.55))",
            }}
          >
            <defs>
              <linearGradient id="zeusGrad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(245,232,205,0.55)" />
                <stop offset="60%" stopColor="rgba(255,196,90,0.35)" />
                <stop offset="100%" stopColor="rgba(180,120,40,0.0)" />
              </linearGradient>
            </defs>
            {/* head */}
            <circle cx="120" cy="58" r="28" fill="url(#zeusGrad)" />
            {/* shoulders + torso silhouette */}
            <path
              d="M60 130 Q120 88 180 130 L196 230 Q120 250 44 230 Z"
              fill="url(#zeusGrad)"
            />
            {/* lightning bolt held in hand */}
            <path
              d="M168 120 L184 96 L176 116 L196 110 L172 150 L182 134 L160 158 Z"
              fill="rgba(255,236,170,0.95)"
              style={{ filter: "drop-shadow(0 0 12px rgba(255,196,90,0.9))" }}
            />
          </svg>

          {/* scoped keyframes — no global CSS pollution */}
          <style>{`
            @keyframes olympus-zeus-in {
              0%   { opacity: 0; transform: translateY(24px) scale(0.97); }
              100% { opacity: 0.92; transform: translateY(0) scale(1); }
            }
            @keyframes olympus-halo-pulse {
              0%   { opacity: 0; }
              60%  { opacity: 1; }
              100% { opacity: 0.85; }
            }
            @media (prefers-reduced-motion: reduce) {
              svg { animation: none !important; opacity: 0.9 !important; }
            }
          `}</style>
        </div>
      )}
    />
  );
}
