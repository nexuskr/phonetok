/**
 * QuickAscensionRail — Right wing: 빠른 입장 + 잭팟 진행률.
 */
import { Link } from "react-router-dom";
import { Crown, Zap } from "lucide-react";
import type { DuelRoom } from "@pkg/duel";

export function QuickAscensionRail({ rooms }: { rooms: DuelRoom[] }) {
  const top = rooms.slice(0, 3);
  const totalJackpot = Math.round(rooms.reduce((s, r) => s + r.jackpotPct, 0) / Math.max(1, rooms.length));

  return (
    <aside className="space-y-3">
      <div className="imperial-card imperial-corner-shine relative overflow-hidden p-4 bg-gradient-to-br from-[#1a0a14] via-[#160a05] to-[#0A0503] border border-pink-500/30">
        <span aria-hidden className="pointer-events-none absolute -inset-px rounded-3xl"
              style={{ boxShadow: "inset 0 0 0 1px hsl(330 90% 60% / 0.25), 0 0 22px hsl(330 90% 60% / 0.18)" }} />
        <div className="text-[10px] tracking-[0.32em] font-black uppercase text-pink-300/90">
          Imperial Jackpot
        </div>
        <h3 className="font-imperial text-2xl text-amber-100 mt-0.5">{totalJackpot}%</h3>
        <p className="text-[11px] text-amber-200/70 mt-0.5 break-keep">
          황실의 보물이 차오르는 중입니다
        </p>
        <div className="relative h-2 mt-3 rounded-full bg-black/50 overflow-hidden border border-pink-400/20">
          <div
            className="absolute inset-y-0 left-0"
            style={{
              width: `${totalJackpot}%`,
              background: "linear-gradient(90deg,#F5C518,#F472B6)",
              boxShadow: "0 0 12px hsl(330 90% 60% / 0.55)",
              willChange: "transform",
            }}
          />
        </div>
      </div>

      <div className="imperial-card p-4 bg-gradient-to-b from-[#160a05] to-[#0A0503] border border-amber-500/25">
        <div className="text-[10px] tracking-[0.32em] font-black uppercase text-amber-400/85 mb-2">
          Quick Ascension
        </div>
        <ul className="space-y-2">
          {top.map((r) => (
            <li key={r.id}>
              <Link
                to={`/duel/arena/${r.id}`}
                className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 bg-black/30 border border-amber-500/15 hover:border-amber-400/40 transition-colors active:scale-[0.985] will-change-transform"
              >
                <div className="min-w-0">
                  <div className="text-[12px] font-bold text-amber-100 truncate">{r.title}</div>
                  <div className="text-[10px] text-amber-300/70 tabular-nums">
                    {r.stake.toLocaleString()} PHON · {r.spectators.toLocaleString()} 관전
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-black text-pink-300">
                  <Zap className="w-3 h-3" /> 즉시
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => {
            const first = rooms[0];
            if (first && typeof window !== "undefined") window.location.href = `/duel/arena/${first.id}`;
          }}
          className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-2xl py-3 font-imperial tracking-[0.22em] text-sm bg-gradient-to-r from-amber-400 via-amber-300 to-pink-500 text-[#1a0a05] font-black active:scale-[0.97] will-change-transform"
          style={{ boxShadow: "0 0 22px hsl(38 92% 60% / 0.55), 0 0 38px hsl(330 90% 60% / 0.3)" }}
        >
          <Crown className="w-4 h-4" /> 옥좌에 오르소서
        </button>
      </div>
    </aside>
  );
}

export default QuickAscensionRail;
