// SugarFeverMaxWinOverlay — 3000×+ Trump-level sweet candy explosion.
// Built on BaseMaxWinOverlay (shared screen-shake / slow-mo / sound pipeline).
// Visual identity: warm pastel candy luxury — NO Zeus, NO marble, NO lightning.
// Crown award is delegated upstream (idempotent dedupe by spinId).
import { Candy } from "lucide-react";
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

// Warm Sugar Luxury palette — pastel pink, warm gold, mint, strawberry, cream.
const SUGAR_PALETTE = {
  // creamy pink → warm gold radial (never deep blue, never cocoa-dark)
  backdrop:
    "radial-gradient(circle at 50% 55%, rgba(255,182,193,0.55) 0%, rgba(248,200,160,0.32) 38%, rgba(255,228,232,0.90) 100%)",
  flareLeft:
    "linear-gradient(90deg, rgba(255,182,193,0.80) 0%, rgba(255,182,193,0) 100%)",
  flareRight:
    "linear-gradient(270deg, rgba(248,200,160,0.80) 0%, rgba(248,200,160,0) 100%)",
  // candy confetti — pink, gold, mint, strawberry, marshmallow cream
  confettiColors: [
    "#ffb6c1", "#f8c8a0", "#b2f0d8",
    "#ff6b7a", "#fff5eb", "#ffd9e6",
  ],
  titleGradientClass:
    "bg-gradient-to-b from-pink-200 via-amber-200 to-pink-500",
  titleGlow: "drop-shadow(0 0 28px rgba(255,182,193,1))",
  multiplierTextClass: "text-rose-50",
  multiplierTextShadow: "0 0 14px rgba(255,107,122,0.85)",
  subTextClass: "text-pink-100",
};

export default function SugarFeverMaxWinOverlay({
  triggerAt = 3000,
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
      ariaLabel="Sugar Fever Max Win"
      // sugar_fever currently borrows the olympus audio pack at the facade level
      // (see SLOT_ID_TO_THEME). We reuse the common legendary_win cue + zeus_decree
      // as the placeholder voice line until dedicated candy voice ships.
      soundKeys={{ primary: "legendary_win", voice: "zeus_decree" }}
      titleText="SUGAR FEVER"
      icon={
        <Candy
          className="h-20 w-20 sm:h-28 sm:w-28 text-pink-300 mb-3"
          style={{
            willChange: "transform, filter",
            filter:
              "drop-shadow(0 0 32px rgba(255,182,193,1)) drop-shadow(0 0 64px rgba(248,200,160,0.7))",
          }}
        />
      }
      palette={SUGAR_PALETTE}
      // 4-burst pastel candy confetti — base layer throttles to ~120 on mobile.
      confettiBursts={[
        { delay: 0,    originY: 0.5,  scalar: 1.5, spread: 130, startVelocity: 65 },
        { delay: 380,  originY: 0.32, scalar: 1.4, spread: 130, startVelocity: 60 },
        { delay: 820,  originY: 0.6,  scalar: 1.4, spread: 130, startVelocity: 60 },
        { delay: 1280, originY: 0.45, scalar: 1.3, spread: 140, startVelocity: 55 },
      ]}
      cinematic={() => (
        // Hero: giant glowing lollipop swirl + candy crown + chocolate splash.
        // No JS animation loop — pure CSS keyframes, GPU composite only.
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-end justify-center overflow-hidden"
          style={{ willChange: "opacity, transform" }}
        >
          {/* warm pink + gold halo behind the hero */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 50% 78%, rgba(255,182,193,0.65) 0%, rgba(248,200,160,0.30) 35%, transparent 70%)",
              animation: "sugar-halo-pulse 1.6s ease-out forwards",
            }}
          />

          {/* chocolate splash arc — wide ribbon at the bottom */}
          <svg
            viewBox="0 0 800 200"
            preserveAspectRatio="none"
            className="absolute bottom-0 left-0 w-full h-[28%] opacity-0"
            style={{
              animation: "sugar-choc-in 0.9s 0.15s cubic-bezier(.16,.84,.36,1) forwards",
            }}
          >
            <defs>
              <linearGradient id="chocSplash" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%"   stopColor="rgba(120,72,44,0.95)" />
                <stop offset="60%"  stopColor="rgba(160,98,60,0.90)" />
                <stop offset="100%" stopColor="rgba(200,140,90,0.55)" />
              </linearGradient>
            </defs>
            <path
              d="M0 200 L0 110 Q 80 60 160 105 Q 240 150 320 95 Q 400 50 480 100 Q 560 150 640 100 Q 720 60 800 110 L 800 200 Z"
              fill="url(#chocSplash)"
            />
            {/* glossy band */}
            <path
              d="M0 110 Q 200 75 400 95 Q 600 115 800 95"
              fill="none"
              stroke="rgba(255,235,215,0.45)"
              strokeWidth="3"
            />
          </svg>

          {/* giant lollipop swirl + candy crown */}
          <svg
            viewBox="0 0 240 320"
            className="relative w-[64%] max-w-[500px] h-auto opacity-0"
            style={{
              animation: "sugar-hero-in 1.2s 0.35s cubic-bezier(.16,.84,.36,1) forwards",
              filter: "drop-shadow(0 0 40px rgba(255,182,193,0.7))",
            }}
          >
            <defs>
              <radialGradient id="lolliBody" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="#fff5eb" />
                <stop offset="55%"  stopColor="#ffb6c1" />
                <stop offset="100%" stopColor="#ff6b7a" />
              </radialGradient>
              <linearGradient id="lolliSwirl" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%"   stopColor="#f8c8a0" />
                <stop offset="50%"  stopColor="#b2f0d8" />
                <stop offset="100%" stopColor="#ffb6c1" />
              </linearGradient>
              <linearGradient id="crownGrad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%"   stopColor="#fff5eb" />
                <stop offset="100%" stopColor="#f8c8a0" />
              </linearGradient>
            </defs>

            {/* stick */}
            <rect x="116" y="160" width="8" height="150" rx="4"
                  fill="rgba(255,245,235,0.95)" />

            {/* lollipop disc */}
            <circle cx="120" cy="150" r="92" fill="url(#lolliBody)" />
            {/* swirl arms — 4-arm pastel pinwheel */}
            <g style={{ transformOrigin: "120px 150px" }}>
              <path d="M120 150 Q160 110 200 130 Q170 160 120 150 Z" fill="url(#lolliSwirl)" opacity="0.92" />
              <path d="M120 150 Q160 190 130 230 Q100 200 120 150 Z" fill="url(#lolliSwirl)" opacity="0.92" />
              <path d="M120 150 Q80 190 40 170 Q70 140 120 150 Z"   fill="url(#lolliSwirl)" opacity="0.92" />
              <path d="M120 150 Q80 110 110 70  Q140 100 120 150 Z" fill="url(#lolliSwirl)" opacity="0.92" />
            </g>
            {/* glossy highlight */}
            <ellipse cx="92" cy="118" rx="22" ry="12" fill="rgba(255,255,255,0.65)" />

            {/* candy crown — wrapped sweets in place of jewels */}
            <g transform="translate(70, 24)">
              <path
                d="M0 50 L0 18 L20 36 L40 8 L60 36 L80 18 L80 50 Z"
                fill="url(#crownGrad)"
                stroke="rgba(200,140, 90,0.65)"
                strokeWidth="1.5"
                style={{ filter: "drop-shadow(0 0 12px rgba(248,200,160,0.95))" }}
              />
              {/* candy "jewels" */}
              <circle cx="40" cy="14" r="5" fill="#ff6b7a" />
              <circle cx="8"  cy="28" r="3.5" fill="#b2f0d8" />
              <circle cx="72" cy="28" r="3.5" fill="#ffb6c1" />
              <circle cx="20" cy="40" r="2.5" fill="#f8c8a0" />
              <circle cx="60" cy="40" r="2.5" fill="#f8c8a0" />
            </g>
          </svg>

          {/* scoped keyframes — no global pollution */}
          <style>{`
            @keyframes sugar-hero-in {
              0%   { opacity: 0; transform: translateY(28px) scale(0.95) rotate(-4deg); }
              60%  { opacity: 0.96; transform: translateY(-4px) scale(1.03) rotate(2deg); }
              100% { opacity: 0.96; transform: translateY(0) scale(1) rotate(0deg); }
            }
            @keyframes sugar-halo-pulse {
              0%   { opacity: 0; }
              60%  { opacity: 1; }
              100% { opacity: 0.9; }
            }
            @keyframes sugar-choc-in {
              0%   { opacity: 0; transform: translateY(24px); }
              100% { opacity: 0.92; transform: translateY(0); }
            }
            @media (prefers-reduced-motion: reduce) {
              svg { animation: none !important; opacity: 0.94 !important; }
            }
          `}</style>
        </div>
      )}
    />
  );
}
