import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, X } from "lucide-react";

type Event = {
  id: string;
  sport: string;
  league: string;
  home: string;
  away: string;
  starts_at: string;
  odds_json: { home: number; draw?: number; away: number };
};

type Pick = { eventId: string; side: "home" | "away"; odd: number; label: string };

export default function ApexSports() {
  const [events, setEvents] = useState<Event[]>([]);
  const [slip, setSlip] = useState<Pick[]>([]);

  useEffect(() => {
    supabase
      .from("sports_mock_events" as any)
      .select("*")
      .eq("active", true)
      .order("starts_at")
      .then(({ data }) => setEvents((data as any) ?? []));
  }, []);

  const totalOdd = slip.reduce((a, b) => a * b.odd, 1);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl md:text-4xl font-black apex-gradient-text">Sportsbook</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          가상 라이브 오즈 (mock). 실제 자금 흐름 없음 — Stake.com sportsbook 인터페이스 데모.
        </p>
      </header>

      <ul className="space-y-3">
        {events.length === 0 && (
          <li className="apex-glass rounded-2xl p-8 text-center text-muted-foreground">
            예정된 경기가 없습니다.
          </li>
        )}
        {events.map((e) => {
          const picked = slip.find((s) => s.eventId === e.id);
          return (
            <li key={e.id} className="apex-glass rounded-2xl p-4 hover:apex-glow-neon transition">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground uppercase tracking-wider">
                <span>{e.sport} · {e.league}</span>
                <span>{new Date(e.starts_at).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}</span>
              </div>
              <p className="mt-2 font-bold">
                {e.home} <span className="text-muted-foreground font-normal">vs</span> {e.away}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(["home", "away"] as const).map((side) => {
                  const odd = e.odds_json[side];
                  const isPicked = picked?.side === side;
                  return (
                    <button
                      key={side}
                      onClick={() =>
                        setSlip((s) => [
                          ...s.filter((x) => x.eventId !== e.id),
                          { eventId: e.id, side, odd, label: `${side === "home" ? e.home : e.away}` },
                        ])
                      }
                      className={`rounded-xl py-2.5 px-3 text-sm transition border flex items-center justify-between ${
                        isPicked
                          ? "apex-gradient text-background border-transparent font-bold"
                          : "apex-glass border-primary/15 hover:border-primary/40"
                      }`}
                    >
                      <span className={isPicked ? "" : "text-muted-foreground"}>
                        {side === "home" ? e.home : e.away}
                      </span>
                      <span className="font-black tabular-nums">{odd.toFixed(2)}</span>
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>

      {slip.length > 0 && (
        <div className="apex-glass-magenta rounded-2xl p-4 sticky bottom-24 apex-glow-magenta animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold">
              <Trophy className="inline w-4 h-4 mr-1 text-primary" />
              {slip.length}개 멀티 베팅
            </span>
            <span className="text-2xl font-black apex-text-neon tabular-nums">
              x{totalOdd.toFixed(2)}
            </span>
          </div>
          <ul className="space-y-1.5 mb-3 max-h-32 overflow-y-auto">
            {slip.map((p) => (
              <li key={p.eventId} className="flex items-center justify-between text-xs">
                <span className="truncate text-muted-foreground">{p.label}</span>
                <span className="flex items-center gap-2">
                  <span className="apex-text-neon font-bold tabular-nums">{p.odd.toFixed(2)}</span>
                  <button
                    onClick={() => setSlip((s) => s.filter((x) => x.eventId !== p.eventId))}
                    className="text-muted-foreground hover:text-accent"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <button
            onClick={() => setSlip([])}
            className="w-full py-2.5 rounded-lg apex-gradient text-background font-bold"
          >
            슬립 비우기 (mock)
          </button>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground text-center">
        실제 sportsbook 활성화 가이드: MIGRATION.md → Phase 4 (Sportradar 연동).
      </p>
    </div>
  );
}
