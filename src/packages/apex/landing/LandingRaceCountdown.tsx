// Live countdown to current Apex race end.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type Race = {
  race_id: string;
  kind: string;
  starts_at: string;
  ends_at: string;
  prize_pool_phon: number;
  total_entries: number;
};

function fmt(ms: number) {
  if (ms <= 0) return "종료";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${h}h ${m}m ${ss}s`;
}

export default function LandingRaceCountdown() {
  const [race, setRace] = useState<Race | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const { data } = await supabase.rpc("apex_get_current_races");
        if (live && Array.isArray(data) && data.length > 0) setRace(data[0] as Race);
      } catch {
        /* silent */
      }
    })();
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, []);

  if (!race) return null;
  const remaining = new Date(race.ends_at).getTime() - now;

  return (
    <section
      aria-label="레이스 카운트다운"
      className="mx-auto mt-4 max-w-6xl rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-card to-accent/10 p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-primary">진행중 레이스 · {race.kind}</p>
          <p className="mt-1 text-2xl font-black tabular-nums">{fmt(remaining)}</p>
          <p className="text-sm text-muted-foreground">
            상금풀{" "}
            <span className="font-semibold text-foreground">
              {Number(race.prize_pool_phon).toLocaleString()} PHON
            </span>{" "}
            · 참가 {race.total_entries.toLocaleString()}명
          </p>
        </div>
        <Link
          to="/apex/race"
          className="rounded-md bg-primary px-5 py-2.5 font-semibold text-primary-foreground hover:opacity-90"
        >
          참가 →
        </Link>
      </div>
    </section>
  );
}
