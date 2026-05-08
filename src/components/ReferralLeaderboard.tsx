import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Crown, Medal } from "lucide-react";

interface Row {
  rank: number;
  inviter_id: string;
  nickname: string | null;
  invitee_count: number;
  weekly_commission: number;
}

interface MyRank {
  rank: number | null;
  invitee_count: number;
  weekly_commission: number;
}

export default function ReferralLeaderboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [me, setMe] = useState<MyRank | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [board, mine] = await Promise.all([
      supabase.rpc("get_weekly_referral_leaderboard", { _limit: 10 }),
      supabase.rpc("get_my_weekly_referral_rank"),
    ]);
    setRows(((board.data as any) ?? []) as Row[]);
    setMe((mine.data as any) ?? null);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return (
    <section className="rounded-3xl bg-gradient-to-br from-amber-500/10 via-background to-background border border-amber-500/30 p-5">
      <header className="flex items-center justify-between mb-3">
        <h2 className="font-imperial text-lg font-black flex items-center gap-2">
          <Trophy className="text-amber-500 w-5 h-5" />
          주간 추천 리더보드
        </h2>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">매주 월요일 00:00 초기화</span>
      </header>

      {loading ? (
        <div className="text-sm text-muted-foreground py-6 text-center">로딩 중…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">
          이번 주 첫 추천자가 되어 보세요 — 1위 보너스 ₩50,000
        </div>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((r) => (
            <li
              key={r.inviter_id}
              className={`flex items-center justify-between rounded-xl px-3 py-2 ${
                r.rank === 1 ? "bg-amber-500/15 border border-amber-500/40"
                : r.rank <= 3 ? "bg-card border border-amber-500/20"
                : "bg-card border border-border/50"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-7 text-center font-black tabular-nums text-sm ${
                  r.rank === 1 ? "text-amber-400" : r.rank <= 3 ? "text-amber-500" : "text-muted-foreground"
                }`}>
                  {r.rank === 1 ? <Crown className="w-4 h-4 inline" /> : r.rank <= 3 ? <Medal className="w-4 h-4 inline" /> : `#${r.rank}`}
                </span>
                <span className="font-bold truncate text-sm">{r.nickname ?? "익명"}</span>
              </div>
              <div className="flex items-center gap-3 text-xs tabular-nums shrink-0">
                <span className="text-muted-foreground">{r.invitee_count}명</span>
                <span className="font-black text-amber-500">₩{r.weekly_commission.toLocaleString()}</span>
              </div>
            </li>
          ))}
        </ol>
      )}

      {me && (
        <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">내 순위</span>
          <span className="font-bold tabular-nums">
            {me.rank ? `#${me.rank}` : "—"} · {me.invitee_count}명 · ₩{(me.weekly_commission ?? 0).toLocaleString()}
          </span>
        </div>
      )}
    </section>
  );
}
