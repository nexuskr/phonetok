// IMPERIAL-SINGULARITY v3.5-H: Burn Top 20 + tier distribution.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { LoadingList } from "@/components/ui/loading-state";
import { tierMeta } from "@/lib/imperialNft";

type Row = { rank: number; user_id: string; lifetime_burn: number; tier: number };

export default function BurnLeaderboardPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [dist, setDist] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const [{ data: lb }, { data: d }] = await Promise.all([
        (supabase as any).rpc("get_burn_leaderboard", { _limit: 20 }),
        (supabase as any).rpc("admin_get_burn_distribution", { _hours: 24 }),
      ]);
      setRows((lb ?? []) as Row[]);
      setDist((d as any)?.tier_distribution ?? {});
    } finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);

  if (loading) return <LoadingList rows={5} />;

  return (
    <div className="grid md:grid-cols-2 gap-3">
      <Card className="p-4">
        <div className="text-xs font-bold mb-3">🔥 Burn Leaderboard (Top 20)</div>
        {rows.length === 0 ? (
          <div className="text-xs text-muted-foreground">아직 소각 기록 없음</div>
        ) : (
          <div className="space-y-1 text-xs font-mono max-h-72 overflow-auto">
            {rows.map((r) => {
              const m = tierMeta(Math.max(0, Math.min(5, r.tier)) as 0|1|2|3|4|5);
              return (
                <div key={r.user_id} className="flex items-center justify-between border-b border-border/30 py-1">
                  <span className="w-8 text-amber-300">#{r.rank}</span>
                  <span className="flex-1 truncate text-muted-foreground">{r.user_id.slice(0, 8)}…</span>
                  <span className="w-24 text-right" style={{ color: m.accent }}>{m.name}</span>
                  <span className="w-28 text-right tabular-nums">{Math.round(r.lifetime_burn).toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      <Card className="p-4">
        <div className="text-xs font-bold mb-3">NFT Tier Distribution</div>
        <div className="space-y-1.5 text-xs">
          {[0,1,2,3,4,5].map((t) => {
            const m = tierMeta(t as 0|1|2|3|4|5);
            const c = Number(dist[String(t)] ?? 0);
            return (
              <div key={t} className="flex items-center gap-2">
                <span className="w-32" style={{ color: m.accent }}>{m.name}</span>
                <div className="flex-1 h-2 rounded-full bg-background/60 overflow-hidden">
                  <div className="h-full" style={{ background: m.accent, width: `${Math.min(100, c * 4)}%` }} />
                </div>
                <span className="w-10 text-right font-mono">{c}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
