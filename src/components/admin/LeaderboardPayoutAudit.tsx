import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Trophy, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

interface Preview {
  rank: number;
  user_id: string;
  invitees: number;
  commission: number;
  would_pay: number;
  already_paid: boolean;
}
interface CronRow {
  id: string;
  caller: string;
  ok: boolean;
  settled_count: number;
  duration_ms: number | null;
  error: string | null;
  created_at: string;
  metadata: any;
}
interface PassVerify {
  iso_week: string;
  progress_users: number;
  finalize_notifications: number;
  unclaimed_max_level: number;
  avg_level: number | null;
  next_week_clean: boolean;
  top_levels: any[] | null;
}

export default function LeaderboardPayoutAudit() {
  const [preview, setPreview] = useState<Preview[]>([]);
  const [isoWeek, setIsoWeek] = useState<string>("");
  const [cron, setCron] = useState<CronRow[]>([]);
  const [pass, setPass] = useState<PassVerify | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [{ data: dry }, { data: logs }, { data: pv }] = await Promise.all([
      supabase.rpc("pay_weekly_leaderboard_dry_run"),
      supabase.from("cron_settle_audit_log")
        .select("*")
        .in("caller", ["weekly_leaderboard_payout", "weekly_pass_finalize"])
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.rpc("verify_weekly_pass_finalize", { _iso_week: null }),
    ]);
    if (dry && (dry as any).preview) {
      setPreview(((dry as any).preview ?? []) as Preview[]);
      setIsoWeek((dry as any).iso_week ?? "");
    }
    setCron((logs ?? []) as CronRow[]);
    setPass((pv as any) ?? null);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <h2 className="font-imperial text-xl font-black flex items-center gap-2">
          <Trophy className="text-amber-400 w-5 h-5" />
          리더보드 정산 · 시즌패스 검증
        </h2>
        <button onClick={load} className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground">
          <RefreshCw className="w-3.5 h-3.5" /> 새로고침
        </button>
      </header>

      {/* Dry run preview */}
      <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          이번 주({isoWeek}) 예상 정산 (dry-run)
        </h3>
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : preview.length === 0 ? (
          <div className="text-xs text-muted-foreground">대상 유저 없음.</div>
        ) : (
          <div className="space-y-2">
            {preview.map((p) => (
              <div key={p.rank} className="flex items-center justify-between rounded-xl bg-card p-3 border border-border/50">
                <div>
                  <div className="text-sm font-bold">#{p.rank} · user {p.user_id.slice(0, 8)}</div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    초대 {p.invitees}명 · 커미션 ₩{p.commission.toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black tabular-nums text-amber-400">+₩{p.would_pay.toLocaleString()}</div>
                  {p.already_paid
                    ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />지급완료</span>
                    : <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-bold">월요일 자동 지급</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Weekly pass verify */}
      {pass && (
        <section className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-4">
          <h3 className="font-bold text-sm mb-3">주간패스 마감 검증 ({pass.iso_week})</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Stat label="참여자" value={pass.progress_users} />
            <Stat label="마감알림 발송" value={pass.finalize_notifications} />
            <Stat label="Lv10 미수령" value={pass.unclaimed_max_level} warn={pass.unclaimed_max_level > 0} />
            <Stat label="평균 Lv" value={pass.avg_level ?? "—"} />
          </div>
          <div className="mt-3 text-xs flex items-center gap-2">
            {pass.next_week_clean
              ? <span className="text-emerald-400 inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />다음 주 progress 초기화 정상</span>
              : <span className="text-rose-400 inline-flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />다음 주에 잔여 progress 발견 — 점검 필요</span>}
          </div>
        </section>
      )}

      {/* Cron audit log */}
      <section>
        <h3 className="font-bold text-sm mb-3">최근 cron 실행 로그</h3>
        {cron.length === 0 ? (
          <div className="text-xs text-muted-foreground">아직 기록 없음.</div>
        ) : (
          <div className="space-y-1.5">
            {cron.map((c) => (
              <div key={c.id} className={`rounded-lg p-2.5 border text-xs flex items-center justify-between ${
                c.ok ? "bg-emerald-500/5 border-emerald-500/20" : "bg-rose-500/5 border-rose-500/30"
              }`}>
                <div className="min-w-0 flex-1">
                  <div className="font-bold flex items-center gap-2">
                    {c.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />}
                    {c.caller}
                    <span className="text-muted-foreground font-normal">· {new Date(c.created_at).toLocaleString()}</span>
                  </div>
                  <div className="text-muted-foreground tabular-nums mt-0.5">
                    settled={c.settled_count} · {c.duration_ms ?? "?"}ms
                    {c.error && <span className="text-rose-400"> · {c.error}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: any; warn?: boolean }) {
  return (
    <div className={`rounded-lg p-2 border ${warn ? "border-rose-500/40 bg-rose-500/10" : "border-border/40 bg-card"}`}>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`font-black tabular-nums ${warn ? "text-rose-400" : ""}`}>{value}</div>
    </div>
  );
}
