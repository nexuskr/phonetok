import { ReactNode } from "react";

/**
 * Cinematic Seoul-night backdrop for /secure-auth.
 * Layers: photo → dim gradient → gold vignette → dot grid → optional pulses (children).
 * Pure CSS + token-only colors. No three.js. Respects prefers-reduced-motion via children.
 */
export function AuthSeoulBackdrop({ children }: { children?: ReactNode }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* 1) Seoul night photo */}
      <img
        src="/auth-seoul-night.jpg"
        alt=""
        width={1920}
        height={1080}
        fetchPriority="high"
        className="absolute inset-0 h-full w-full object-cover object-center select-none"
        draggable={false}
      />

      {/* 2) Dim gradient — top translucent, bottom near-opaque for form readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/35 via-background/65 to-background/95 md:from-background/30 md:via-background/55 md:to-background/90" />

      {/* mobile extra dim */}
      <div className="absolute inset-0 bg-background/35 md:hidden" />

      {/* 3) Gold vignette — top-right empire glow */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 70% 25%, hsl(var(--gold)/0.22), transparent 65%)",
        }}
      />
      {/* second gold pool — bottom-left */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 45% at 15% 85%, hsl(var(--gold)/0.14), transparent 60%)",
        }}
      />

      {/* 4) Dot grid + meridian lines — "data city" overlay */}
      <div
        className="absolute inset-0 opacity-[0.10]"
        style={{
          backgroundImage:
            "radial-gradient(hsl(var(--gold)/0.55) 0.8px, transparent 0.8px)",
          backgroundSize: "22px 22px",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--gold)/0.6) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--gold)/0.6) 1px, transparent 1px)",
          backgroundSize: "180px 180px",
        }}
      />

      {/* 5) Top hairline + bottom fade for cinematic frame */}
      <span className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-gold/55 to-transparent" />
      <span className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-background to-transparent" />

      {/* 6) Live pulses (children) */}
      {children}
    </div>
  );
}

export default AuthSeoulBackdrop;
