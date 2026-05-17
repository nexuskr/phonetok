/**
 * HeatLevelBadge — Adaptive Heat 1~5 칩.
 */
import { HEAT_LABEL } from "@pkg/duel";

export function HeatLevelBadge({ level }: { level: 1 | 2 | 3 | 4 | 5 }) {
  const intensity = level / 5;
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black tracking-[0.18em] uppercase border"
      style={{
        background: `linear-gradient(90deg, hsl(38 92% 56% / ${0.12 + intensity * 0.18}), hsl(330 90% 60% / ${0.10 + intensity * 0.18}))`,
        borderColor: `hsl(38 92% ${60 - level * 4}% / 0.55)`,
        color: "hsl(40 100% 88%)",
        textShadow: "0 0 12px hsl(38 92% 60% / 0.55)",
        willChange: "transform",
      }}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full imperial-pulse-dot"
        style={{ background: "linear-gradient(180deg,#FDE68A,#F472B6)" }}
      />
      Lv.{level} · {HEAT_LABEL[level]}
    </div>
  );
}

export default HeatLevelBadge;
