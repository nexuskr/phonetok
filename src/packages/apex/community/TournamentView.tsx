import { useEffect, useState } from "react";
import { Calendar, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import TournamentBracket from "./TournamentBracket";
import TournamentLeaderboard, { type TournamentRow } from "./TournamentLeaderboard";

interface Tournament {
  id: string;
  name: string;
  prize_pool_phon: number;
  start_at: string;
  end_at: string;
  status: "scheduled" | "live" | "done";
  bracket: { slots?: { name: string; score?: number; winner?: boolean }[]; leaderboard?: TournamentRow[] } | null;
}

export default function TournamentView() {
  const [list, setList] = useState<Tournament[]>([]);
  const [active, setActive] = useState<Tournament | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("apex_tournaments" as any)
        .select("id,name,prize_pool_phon,start_at,end_at,status,bracket")
        .order("start_at", { ascending: false })
        .limit(10);
      const items = (data ?? []) as unknown as Tournament[];
      setList(items);
      setActive(items.find((t) => t.status === "live") ?? items[0] ?? null);
    })();
  }, []);

  if (list.length === 0) {
    return (
      <div className="p-4">
        <div className="rounded-xl border border-border bg-card/50 p-8 text-center space-y-2">
          <div className="text-3xl">🏆</div>
          <h2 className="text-xl font-black">APOCALYPSE CUP</h2>
          <p className="text-sm text-muted-foreground">$1M PHON 풀 — 곧 시작합니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black">TOURNAMENT</h1>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {list.length} active / scheduled
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {list.map((t) => (
          <button key={t.id} onClick={() => setActive(t)}
            className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-bold transition ${
              active?.id === t.id ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"
            }`}>
            {t.name} · <span className="uppercase">{t.status}</span>
          </button>
        ))}
      </div>

      {active && (
        <>
          <div className="rounded-xl border border-border bg-card/50 p-4 grid grid-cols-3 gap-3 text-xs">
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">Prize Pool</div>
              <div className="text-lg font-black text-accent tabular-nums flex items-center gap-1">
                <Coins className="w-4 h-4" /> {active.prize_pool_phon.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">Starts</div>
              <div className="text-sm font-bold flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {new Date(active.start_at).toLocaleString("ko-KR")}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">Ends</div>
              <div className="text-sm font-bold">{new Date(active.end_at).toLocaleString("ko-KR")}</div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/50 p-4">
            <TournamentBracket slots={active.bracket?.slots ?? []} />
          </div>

          <div className="rounded-xl border border-border bg-card/50 p-4">
            <h3 className="text-sm font-black mb-2">LEADERBOARD</h3>
            <TournamentLeaderboard rows={active.bracket?.leaderboard ?? []} />
          </div>
        </>
      )}
    </div>
  );
}
