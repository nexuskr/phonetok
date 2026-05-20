import { Trophy } from "lucide-react";

export interface TournamentRow {
  rank: number;
  name: string;
  score: number;
  prize_phon: number;
}

export default function TournamentLeaderboard({ rows }: { rows: TournamentRow[] }) {
  if (rows.length === 0) {
    return <div className="text-center text-xs text-muted-foreground py-6">아직 참가자가 없습니다.</div>;
  }
  return (
    <div className="divide-y divide-border">
      {rows.map((r) => (
        <div key={r.rank} className="flex items-center justify-between py-2 text-sm">
          <div className="flex items-center gap-3 min-w-0">
            <span className={`w-6 text-right font-black tabular-nums ${r.rank === 1 ? "text-primary" : "text-muted-foreground"}`}>
              {r.rank}
            </span>
            {r.rank === 1 && <Trophy className="w-4 h-4 text-yellow-400" />}
            <span className="truncate">{r.name}</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="tabular-nums text-muted-foreground">{r.score.toLocaleString()} pts</span>
            <span className="tabular-nums text-accent font-bold">{r.prize_phon.toLocaleString()} PHON</span>
          </div>
        </div>
      ))}
    </div>
  );
}
