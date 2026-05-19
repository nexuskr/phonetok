import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";
import { Gift, Check, Coins } from "lucide-react";

type Mission = {
  code: string;
  title: string;
  reward_phon: number;
  daily_cap: number;
  sort_order: number;
  active: boolean;
};

export default function ApexFreeMoney() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [claimed, setClaimed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data: ms } = await supabase
      .from("free_missions" as any)
      .select("*")
      .eq("active", true)
      .order("sort_order");

    const today = new Date().toISOString().slice(0, 10);
    const { data: claims } = await supabase
      .from("free_mission_claims" as any)
      .select("mission_code")
      .eq("claim_date", today);

    setMissions((ms as any) ?? []);
    setClaimed(new Set(((claims as any) ?? []).map((c: any) => c.mission_code)));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function claim(code: string) {
    setBusy(code);
    const { data, error } = await supabase.rpc("claim_free_mission" as any, { _code: code });
    setBusy(null);
    if (error) {
      notify.error(error.message ?? "수령 실패");
      return;
    }
    notify.success(`+${(data as any)?.reward_phon ?? 0} PHON 적립!`);
    load();
  }

  const totalToday = missions.reduce((a, m) => a + m.reward_phon, 0);
  const earnedToday = missions
    .filter((m) => claimed.has(m.code))
    .reduce((a, m) => a + m.reward_phon, 0);
  const pct = totalToday ? Math.round((earnedToday / totalToday) * 100) : 0;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl md:text-4xl font-black apex-gradient-text">
          Free Money 부업 허브
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          오늘 미션 완료 시 즉시 PHON 적립. Freecash 보다 빠르고 카지노까지 갖춘 단 하나의 부업.
        </p>
      </header>

      {/* Today progress */}
      <section className="apex-glass rounded-2xl p-5 apex-glow-neon">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              오늘 적립
            </p>
            <p className="mt-1 text-3xl font-black apex-text-neon tabular-nums">
              {earnedToday.toLocaleString()}
              <span className="text-sm text-muted-foreground ml-2">/ {totalToday.toLocaleString()} PHON</span>
            </p>
          </div>
          <div className="text-right">
            <Coins className="w-8 h-8 text-primary ml-auto" />
            <p className="text-[10px] text-muted-foreground mt-1">{pct}% 완료</p>
          </div>
        </div>
        <div className="mt-3 h-2 rounded-full bg-muted/30 overflow-hidden">
          <div
            className="h-full apex-gradient transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </section>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">불러오는 중…</div>
      ) : missions.length === 0 ? (
        <div className="apex-glass rounded-2xl p-8 text-center text-muted-foreground">
          미션이 비어 있습니다.
        </div>
      ) : (
        <ul className="space-y-3">
          {missions.map((m) => {
            const done = claimed.has(m.code);
            return (
              <li
                key={m.code}
                className={`apex-glass rounded-2xl p-4 flex items-center justify-between transition ${
                  done ? "opacity-60" : "hover:apex-glow-neon"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    done ? "bg-muted" : "apex-gradient"
                  }`}>
                    {done ? (
                      <Check className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <Gift className="w-5 h-5 text-background" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold truncate">{m.title}</p>
                    <p className="text-xs apex-text-neon tabular-nums">
                      +{m.reward_phon.toLocaleString()} PHON
                    </p>
                  </div>
                </div>
                <button
                  disabled={done || busy === m.code}
                  onClick={() => claim(m.code)}
                  className={`px-5 py-2.5 rounded-lg font-bold text-sm transition whitespace-nowrap ${
                    done
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : "apex-gradient text-background hover:apex-glow-neon"
                  }`}
                >
                  {done ? "완료" : busy === m.code ? "…" : "수령"}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-[11px] text-muted-foreground text-center pt-3">
        모든 보상은 in-game PHON. KRW 출금은 Phonara <a href="/wallet" className="text-primary underline">/wallet</a> 에서 처리됩니다.
      </p>
    </div>
  );
}
