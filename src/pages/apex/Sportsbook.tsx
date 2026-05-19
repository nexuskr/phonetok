import { useState } from "react";
import { Trophy, Coins } from "lucide-react";
import { GlowCard } from "@/packages/apex/components/GlowCard";
import { NeonButton } from "@/packages/apex/components/NeonButton";
import { ParticleBurst } from "@/packages/apex/components/ParticleBurst";
import { ApexFairBadge } from "@/packages/apex/games/ProvablyFairBadge";
import { useApexGame } from "@/packages/apex/games/useApexGame";

const MATCHES = [
  { id: "epl-1", league: "EPL", home: "Man City", away: "Liverpool", odds: { home: 2.15, draw: 3.40, away: 3.20 } },
  { id: "nba-1", league: "NBA", home: "Lakers",   away: "Warriors",  odds: { home: 1.92, draw: 0,    away: 1.95 } },
  { id: "mlb-1", league: "MLB", home: "Dodgers",  away: "Yankees",   odds: { home: 2.05, draw: 0,    away: 1.80 } },
  { id: "ufc-1", league: "UFC", home: "Jones",    away: "Aspinall",  odds: { home: 1.65, draw: 0,    away: 2.30 } },
];

export default function ApexSportsbook() {
  const [bet, setBet] = useState(100);
  const [currency, setCurrency] = useState<"phon" | "usdt">("phon");
  const [picked, setPicked] = useState<{ matchId: string; side: "home" | "draw" | "away"; odds: number } | null>(null);
  const [burst, setBurst] = useState(0);
  const { play, loading, last } = useApexGame();

  async function placeBet() {
    if (!picked) return;
    const res = await play(
      "sportsbook",
      currency === "phon" ? { phon: bet } : { usdt: bet },
      { match_id: picked.matchId, side: picked.side, odds: picked.odds },
    );
    if (res?.ok && (Number(res.payout_phon) + Number(res.payout_usdt)) > bet) setBurst((x) => x + 1);
  }

  return (
    <div className="space-y-5">
      <ParticleBurst trigger={burst} />

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black apex-gradient-text flex items-center gap-2">
          <Trophy className="w-7 h-7 text-accent" /> SPORTSBOOK
        </h1>
        <ApexFairBadge hash={last?.server_seed_hash} seed={last?.client_seed} nonce={last?.nonce} />
      </div>

      <div className="flex gap-2">
        <button onClick={() => setCurrency("phon")}
          className={`flex-1 rounded-xl py-2.5 font-black text-sm border transition ${currency === "phon" ? "border-primary bg-primary/15 apex-text-neon" : "border-border text-muted-foreground"}`}>
          <Coins className="inline w-4 h-4 mr-1.5" /> PHON
        </button>
        <button onClick={() => setCurrency("usdt")}
          className={`flex-1 rounded-xl py-2.5 font-black text-sm border transition ${currency === "usdt" ? "border-accent bg-accent/15 apex-text-magenta" : "border-border text-muted-foreground"}`}>
          USDT
        </button>
      </div>

      <div className="space-y-3">
        {MATCHES.map((m) => (
          <GlowCard key={m.id} hover={false}>
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
                <span className="text-primary">{m.league}</span>
                <span className="apex-text-magenta">LIVE</span>
              </div>
              <div className="flex items-center justify-between font-black">
                <span>{m.home}</span>
                <span className="text-muted-foreground text-xs">vs</span>
                <span>{m.away}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1">
                {(["home", "draw", "away"] as const).map((side) => {
                  const odd = m.odds[side];
                  if (!odd) return <div key={side} />;
                  const sel = picked?.matchId === m.id && picked.side === side;
                  return (
                    <button key={side}
                      onClick={() => setPicked({ matchId: m.id, side, odds: odd })}
                      className={`rounded-lg py-2 text-sm font-black border transition ${sel ? "border-primary bg-primary/20 apex-text-neon apex-pulse" : "border-border hover:border-primary/50"}`}>
                      <div className="text-[9px] uppercase text-muted-foreground">{side}</div>
                      {odd.toFixed(2)}x
                    </button>
                  );
                })}
              </div>
            </div>
          </GlowCard>
        ))}
      </div>

      <GlowCard>
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Bet Slip</span>
            <span className="apex-text-magenta">{picked ? `${picked.side.toUpperCase()} @ ${picked.odds}x` : "Pick a side"}</span>
          </div>
          <input type="number" min={10} value={bet}
            onChange={(e) => setBet(Math.max(10, Number(e.target.value) || 10))}
            className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm font-bold" />
          <NeonButton variant="magenta" size="lg" pulse className="w-full" onClick={placeBet} disabled={loading || !picked}>
            {loading ? "PLACING…" : `PLACE · ${bet.toLocaleString()} ${currency.toUpperCase()}`}
          </NeonButton>
          <p className="text-center text-[10px] text-muted-foreground">Mock odds · 4.5% vig · USDT mock balance (no withdrawal)</p>
        </div>
      </GlowCard>
    </div>
  );
}
