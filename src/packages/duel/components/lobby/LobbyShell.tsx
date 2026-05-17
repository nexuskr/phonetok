/**
 * LobbyShell — 3-Wing 황실 로비 레이아웃.
 */
import { ReactNode } from "react";

export function LobbyShell({
  left,
  center,
  right,
  header,
}: {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  header: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0A0503] text-amber-50">
      {/* Ambient throne glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(60% 40% at 50% 0%, hsl(38 92% 56% / 0.10), transparent 60%), radial-gradient(50% 35% at 50% 100%, hsl(330 90% 60% / 0.10), transparent 60%)",
        }}
      />
      <div className="relative z-10 container mx-auto px-3 md:px-6 py-5 md:py-8">
        {header}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-[260px_1fr_280px] gap-4 md:gap-5">
          <div className="hidden md:block">{left}</div>
          <div>{center}</div>
          <div>{right}</div>
        </div>
      </div>
    </div>
  );
}

export default LobbyShell;
