/**
 * Phase 4 Sprint 3 — Dynamic Island Pill
 * ---------------------------------------
 * 화면 상단 중앙 캡슐. transform + opacity only. 60fps.
 * - idle 시 invisible (DOM 유지, opacity 0, pointer-events:none)
 * - safe-area-inset-top 존중
 * - framer-motion 사용하지 않음 (Layer 1 bundle 영향 0)
 */
import { useDynamicIsland, dynamicIsland } from "../useDynamicIsland";

const KIND_STYLES: Record<string, string> = {
  loading: "bg-black/80 text-white/95",
  success: "bg-emerald-600/90 text-white",
  error: "bg-rose-600/90 text-white",
  info: "bg-amber-500/90 text-black",
  idle: "bg-black/0 text-transparent",
};

export function DynamicIslandPill() {
  const s = useDynamicIsland();
  const visible = s.kind !== "idle";
  return (
    <div
      aria-live="polite"
      role="status"
      style={{
        position: "fixed",
        top: "calc(env(safe-area-inset-top, 0px) + 8px)",
        left: "50%",
        zIndex: 70,
        transform: `translate3d(-50%, ${visible ? "0" : "-16px"}, 0) scale(${visible ? 1 : 0.92})`,
        opacity: visible ? 1 : 0,
        transition: "transform 240ms cubic-bezier(.2,.8,.2,1), opacity 200ms ease-out",
        pointerEvents: visible ? "auto" : "none",
        willChange: "transform, opacity",
      }}
      onClick={() => dynamicIsland.hide()}
      className={[
        "rounded-full px-4 py-2 text-sm font-medium shadow-lg backdrop-blur-md",
        "max-w-[88vw] truncate select-none cursor-pointer",
        KIND_STYLES[s.kind] ?? KIND_STYLES.idle,
      ].join(" ")}
    >
      {s.kind === "loading" && (
        <span
          className="mr-2 inline-block h-2 w-2 rounded-full bg-white/90"
          style={{ animation: "pulse 1.2s ease-in-out infinite" }}
        />
      )}
      {s.text ?? ""}
    </div>
  );
}

export default DynamicIslandPill;
