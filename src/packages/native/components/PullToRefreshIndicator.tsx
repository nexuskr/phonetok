/**
 * Phase 4 Sprint 3 — Pull-to-Refresh Indicator
 * ---------------------------------------------
 * transform + opacity only. 60fps.
 */
type Props = {
  pull: number;
  threshold: number;
  busy: boolean;
};

export function PullToRefreshIndicator({ pull, threshold, busy }: Props) {
  const pct = Math.min(1, pull / threshold);
  const opacity = Math.min(1, pct);
  const rotate = busy ? 360 : pct * 270;
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: 0,
        left: "50%",
        transform: `translate3d(-50%, ${Math.max(0, pull - 32)}px, 0)`,
        opacity,
        pointerEvents: "none",
        willChange: "transform, opacity",
      }}
      className="z-30"
    >
      <div
        className="h-7 w-7 rounded-full border-2 border-amber-400/80 border-t-transparent"
        style={{
          transform: `rotate(${rotate}deg)`,
          transition: busy ? "transform 800ms linear" : "transform 80ms linear",
          animation: busy ? "spin 0.9s linear infinite" : undefined,
          willChange: "transform",
        }}
      />
    </div>
  );
}

export default PullToRefreshIndicator;
