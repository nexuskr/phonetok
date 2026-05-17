/**
 * LobbyFab — Bottom Nav 위에 떠있는 황금 FAB → /lobby.
 * FloatingSlot(bottomLeft) 사용 — 다른 위젯과 충돌 0.
 * 일부 경로(/lobby, /auth 등)에서는 자동 숨김.
 */
import { Link, useLocation } from "react-router-dom";
import { FloatingSlot } from "@/components/ui/floating-dock";

const HIDE_PATHS = [
  "/", "/lobby", "/auth", "/secure-auth", "/forgot-password",
  "/reset-password", "/auth/callback", "/legal", "/live",
  "/i", "/avatar/studio",
];

export default function LobbyFab() {
  const loc = useLocation();
  const hide = HIDE_PATHS.some(
    (r) => r === loc.pathname || (r !== "/" && loc.pathname.startsWith(r)),
  );
  if (hide) return null;

  return (
    <FloatingSlot slot="bottomLeft" order={5}>
      <Link
        to="/lobby"
        aria-label="황제의 로비 입장"
        className="group flex items-center gap-2 rounded-full pl-2 pr-3.5 py-2 bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 text-black font-bold text-xs shadow-xl shadow-amber-500/40 ring-1 ring-amber-300/60 active:scale-95 transition"
      >
        <span className="grid place-items-center w-7 h-7 rounded-full bg-black/30 text-base animate-pulse">
          👑
        </span>
        <span className="tracking-wide">로비 입장</span>
      </Link>
    </FloatingSlot>
  );
}
