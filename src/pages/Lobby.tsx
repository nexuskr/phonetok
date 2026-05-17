/**
 * /lobby — 황제들의 가상 로비 (Phase D Slice 2).
 * - tier 자동 판정: low → SVG fallback, mid/high → R3F 3D
 * - 모바일 first
 */
import { lazy, Suspense, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { detectDeviceTier } from "@/components/lobby/v3/useDeviceTier";

const VirtualLobby3D = lazy(() => import("@/components/lobby/v3/VirtualLobby3D"));
const VirtualLobby2DFallback = lazy(() => import("@/components/lobby/v3/VirtualLobby2DFallback"));

function detectWebGL(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function Lobby() {
  const [mode, setMode] = useState<"3d" | "2d" | null>(null);

  useEffect(() => {
    const tier = detectDeviceTier();
    const webgl = detectWebGL();
    setMode(tier === "low" || !webgl ? "2d" : "3d");
  }, []);

  return (
    <div className="fixed inset-0 bg-[#0B0E1A] text-white flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-black/40 backdrop-blur">
        <div>
          <h1 className="text-base font-bold tracking-wide">
            👑 황제들의 로비
          </h1>
          <p className="text-[11px] text-amber-300/80">
            지금 이 순간, 폐하들이 당신을 지켜보고 있습니다
          </p>
        </div>
        <Link
          to="/avatar/studio"
          className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-xs px-4 py-2 shadow-lg shadow-amber-500/30 active:scale-95 transition"
        >
          내 황제 꾸미기
        </Link>
      </header>

      <main className="flex-1 relative">
        <Suspense fallback={<div className="grid place-items-center h-full text-amber-300/80 text-sm">로비 입장 중…</div>}>
          {mode === "3d" && <VirtualLobby3D />}
          {mode === "2d" && <VirtualLobby2DFallback />}
        </Suspense>
      </main>

      <footer className="px-4 py-2 text-center text-[10px] text-white/40 border-t border-white/5">
        이 모습은 오직 폐하만의 것 — PHON 으로 왕관을 강화하세요
      </footer>
    </div>
  );
}
