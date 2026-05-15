import CasinoLayout from "@/components/casino/CasinoLayout";
import OlympusSlot from "@/components/slots/OlympusSlot";
import { COSMIC_FORGE_THEME } from "@/components/slots/themes";
import Disclaimer from "@/components/Disclaimer";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useSlotSound } from "@/hooks/useSlotSound";
import CosmicNebulaCanvas from "@/components/slots/CosmicNebulaCanvas";
import CosmicPaytableSheet from "@/components/slots/CosmicPaytableSheet";
import CosmicMaxWinOverlay from "@/components/celebration/CosmicMaxWinOverlay";
import DevWinCheats from "@/components/slots/DevWinCheats";
import { useEffect } from "react";

export default function CosmicForge5000Page() {
  const user = useRequireAuth();
  useSlotSound("cosmic_forge");

  // Spin/Bet 영역 터치 햅틱 — 위임형 리스너 (메모리 누수 0)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPointer = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      // Spin 버튼/Bet 컨트롤만 — OlympusSlot 내부 버튼들에 매칭
      const btn = t.closest("button");
      if (!btn) return;
      const aria = btn.getAttribute("aria-label") ?? "";
      const txt = btn.textContent ?? "";
      if (
        /spin|스핀|bet|베팅|\+|−|-/i.test(aria + " " + txt) &&
        typeof navigator !== "undefined" &&
        typeof navigator.vibrate === "function"
      ) {
        try { navigator.vibrate(8); } catch { /* */ }
      }
    };
    const root = document.getElementById("cosmic-forge-root");
    root?.addEventListener("pointerdown", onPointer, { passive: true });
    return () => root?.removeEventListener("pointerdown", onPointer);
  }, []);

  if (!user) return null;

  return (
    <CasinoLayout backTo="/casino" backLabel="슬롯 로비로">
      <div
        id="cosmic-forge-root"
        className="relative isolate"
        style={{ transform: "translate3d(0,0,0)" }}
      >
        {/* Nebula 배경 — absolute, pointer-events-none */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <CosmicNebulaCanvas />
          {/* 좌우 cosmic light flare — 항상 ON, 저강도 */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 h-full w-[18%]"
            style={{
              background:
                "linear-gradient(90deg, rgba(167,139,250,0.18) 0%, rgba(167,139,250,0) 100%)",
              filter: "blur(20px)",
              willChange: "transform",
              transform: "translate3d(0,0,0)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute right-0 top-0 h-full w-[18%]"
            style={{
              background:
                "linear-gradient(270deg, rgba(34,211,238,0.16) 0%, rgba(34,211,238,0) 100%)",
              filter: "blur(20px)",
              willChange: "transform",
              transform: "translate3d(0,0,0)",
            }}
          />
        </div>

        <div className="container py-4 space-y-4 [&_button:active]:scale-[0.98] [&_button]:transition-transform">
          {/* Header — Paytable 트리거 */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full bg-cyan-300"
                style={{ boxShadow: "0 0 12px rgba(34,211,238,0.9)" }}
                aria-hidden
              />
              <span className="text-xs font-semibold text-violet-100/90 tracking-wider uppercase">
                Cosmic Forge · Signature
              </span>
            </div>
            <CosmicPaytableSheet />
          </div>

          <OlympusSlot theme={COSMIC_FORGE_THEME} />
          <Disclaimer />
        </div>

        {/* MAX WIN 전용 cinematic 레이어 */}
        <CosmicMaxWinOverlay
          triggerAt={COSMIC_FORGE_THEME.maxMultiplier}
          durationMs={3000}
        />

        {/* DEV 전용 — production 자동 제거 */}
        <DevWinCheats
          themeKey="cosmic"
          unitLabel="DEMO 칩"
          maxMultiplier={COSMIC_FORGE_THEME.maxMultiplier}
        />
      </div>
    </CasinoLayout>
  );
}
