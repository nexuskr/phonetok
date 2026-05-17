/**
 * HallOfSovereigns — Left wing: 명예의 전당 Top 5.
 */
const SOVEREIGNS = [
  { rank: 1, nick: "황제#7821", emoji: "👑", crowns: 482, color: "#F5C518" },
  { rank: 2, nick: "황제#3094", emoji: "🦅", crowns: 367, color: "#F472B6" },
  { rank: 3, nick: "황제#5527", emoji: "🐉", crowns: 318, color: "#A78BFA" },
  { rank: 4, nick: "황제#1148", emoji: "🦁", crowns: 274, color: "#FF8A3D" },
  { rank: 5, nick: "황제#9013", emoji: "🐺", crowns: 251, color: "#60A5FA" },
];

export function HallOfSovereigns() {
  return (
    <aside className="imperial-card imperial-corner-shine relative overflow-hidden p-4 bg-gradient-to-b from-[#1a0f08] to-[#0A0503] border border-amber-500/25">
      <div className="text-[10px] tracking-[0.32em] font-black uppercase text-amber-400/85 mb-1">
        Hall of Sovereigns
      </div>
      <h3 className="font-imperial text-lg text-amber-100 mb-3 leading-tight">
        명예의 전당
      </h3>
      <ol className="space-y-2">
        {SOVEREIGNS.map((s) => (
          <li
            key={s.rank}
            className="flex items-center gap-3 rounded-xl px-2.5 py-2 bg-black/30 border border-amber-500/15 hover:border-amber-400/40 transition-colors"
            style={{ willChange: "transform" }}
          >
            <div
              className="w-9 h-9 rounded-lg grid place-items-center text-lg shrink-0"
              style={{
                background: `radial-gradient(circle at 30% 30%, ${s.color}, #0A0503)`,
                boxShadow: `0 0 14px ${s.color}55, inset 0 0 8px ${s.color}33`,
              }}
            >
              {s.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-bold text-amber-100 truncate">
                #{s.rank} · {s.nick}
              </div>
              <div className="text-[10px] text-amber-300/70 tabular-nums">
                Crown {s.crowns}
              </div>
            </div>
            {s.rank === 1 && (
              <span className="text-[9px] tracking-[0.2em] font-black text-pink-300 bg-pink-500/15 border border-pink-400/40 rounded-full px-2 py-0.5">
                EMPEROR
              </span>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[10px] text-amber-300/60 leading-snug break-keep">
        폐하의 이름이 이 전당에 새겨지길 황실은 기다립니다.
      </p>
    </aside>
  );
}

export default HallOfSovereigns;
