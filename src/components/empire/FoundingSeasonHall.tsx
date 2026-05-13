import { useEffect, useState, useMemo } from "react";
import { Crown, Loader2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LoadingList } from "@/components/ui/loading-state";
import { notify } from "@/lib/notify";

type State = {
  active: boolean;
  season?: {
    id: string; code: string; title: string; subtitle?: string;
    total_seats: number; perks: string[]; starts_at: string; ends_at?: string;
  };
  total?: number;
  remaining?: number;
  claimed?: number;
  recent?: { seat_no: number; masked_nick: string; claimed_at: string }[];
};

type Seat = {
  seat_no: number;
  masked_nick: string | null;
  claimed_at: string | null;
  is_mine: boolean;
};

const errMap: Record<string, string> = {
  auth_required: "로그인이 필요합니다.",
  no_active_season: "현재 진행 중인 시즌이 없습니다.",
  season_ended: "이 시즌은 종료되었습니다.",
  godmode_required: "Founding Emperor 좌석은 첫 입금 God Mode 보유자만 청구할 수 있습니다.",
  already_claimed: "이미 이 시즌의 좌석을 보유하고 계십니다.",
  season_full: "모든 좌석이 마감되었습니다.",
};

export default function FoundingSeasonHall() {
  const [state, setState] = useState<State | null>(null);
  const [seats, setSeats] = useState<Seat[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data: s }, { data: g }] = await Promise.all([
      supabase.rpc("get_founding_season_state"),
      supabase.rpc("get_founding_season_grid", { _season_id: undefined }),
    ]);
    setState((s as unknown as State) ?? { active: false });
    setSeats((g as Seat[]) ?? []);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("founding_season_hall_" + Math.random().toString(36).slice(2))
      .on("postgres_changes", { event: "*", schema: "public", table: "founding_season_seats" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const myseat = useMemo(() => seats?.find((s) => s.is_mine) ?? null, [seats]);

  const claim = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("claim_founding_season_seat");
      if (error) throw error;
      const seatNo = (data as any)?.seat_no;
      notify.success(`👑 좌석 #${seatNo} 점유 완료! 영원히 당신의 자리입니다.`);
      await load();
    } catch (e: any) {
      const code = e?.message ?? String(e);
      notify.error(errMap[code] ?? code);
    } finally {
      setBusy(false);
    }
  };

  if (!state) return <LoadingList rows={6} />;
  if (!state.active || !state.season) {
    return (
      <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
        현재 진행 중인 Founding Season이 없습니다.
      </div>
    );
  }

  const pct = state.total ? ((state.claimed ?? 0) / state.total) * 100 : 0;
  const urgent = (state.remaining ?? 0) <= 10;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl p-6 border border-primary/30 bg-gradient-to-br from-primary/10 via-background to-money-strong/10">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <motion.div
            className="absolute -inset-1/4 bg-gradient-radial from-primary/40 to-transparent"
            animate={{ rotate: 360 }}
            transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          />
        </div>
        <div className="relative">
          <div className="flex items-center gap-2 text-primary">
            <Crown className="w-5 h-5" />
            <span className="text-[11px] font-bold tracking-widest uppercase">{state.season.code}</span>
          </div>
          <h2 className="font-imperial font-black text-2xl sm:text-3xl mt-1 text-gradient-imperial">
            {state.season.title}
          </h2>
          {state.season.subtitle && (
            <p className="mt-2 text-sm text-muted-foreground break-keep">{state.season.subtitle}</p>
          )}

          <div className="mt-4 flex items-center gap-4">
            <div>
              <div className="text-[10px] text-muted-foreground">잔여 좌석</div>
              <div className={`font-imperial font-black text-3xl tabular-nums ${urgent ? "text-destructive animate-pulse" : "text-money-strong"}`}>
                {state.remaining}<span className="text-base text-muted-foreground">/{state.total}</span>
              </div>
            </div>
            <div className="flex-1">
              <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-primary to-money-strong"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground tabular-nums">{pct.toFixed(1)}% 점유</div>
            </div>
          </div>

          {/* Perks */}
          {state.season.perks?.length > 0 && (
            <ul className="mt-4 grid sm:grid-cols-2 gap-1.5">
              {state.season.perks.map((p, i) => (
                <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                  <Sparkles className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                  <span className="break-keep">{p}</span>
                </li>
              ))}
            </ul>
          )}

          {/* CTA */}
          <div className="mt-5">
            {myseat ? (
              <div className="rounded-2xl p-3 border border-money-strong/40 bg-money-strong/10 text-center">
                <div className="text-[10px] text-muted-foreground">내 좌석</div>
                <div className="font-imperial font-black text-2xl text-money-strong">
                  #{myseat.seat_no}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  영원히 보존됩니다.
                </div>
              </div>
            ) : (
              <Button
                onClick={claim}
                disabled={busy || (state.remaining ?? 0) <= 0}
                size="lg"
                className="w-full"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Crown className="w-4 h-4 mr-2" />}
                {(state.remaining ?? 0) <= 0 ? "마감 — 다음 시즌을 기다려주세요" : "지금 좌석 청구하기 (1회 한정)"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Recent claimers ticker */}
      {state.recent && state.recent.length > 0 && (
        <div className="glass rounded-2xl p-3">
          <div className="text-[10px] text-muted-foreground mb-2">최근 점유</div>
          <div className="flex flex-wrap gap-2">
            {state.recent.map((r) => (
              <span key={r.seat_no} className="text-[11px] px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                #{r.seat_no} · {r.masked_nick}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Seat grid */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Crown className="w-4 h-4 text-primary" />
          <h3 className="font-imperial font-bold text-lg">명예의 전당</h3>
        </div>
        {!seats ? <LoadingList rows={3} /> : (
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
            {seats.map((s) => (
              <div
                key={s.seat_no}
                title={s.masked_nick ?? `좌석 #${s.seat_no}`}
                className={`aspect-square rounded-lg border flex flex-col items-center justify-center text-[9px] font-bold tabular-nums transition ${
                  s.is_mine
                    ? "border-money-strong bg-money-strong/20 text-money-strong"
                    : s.masked_nick
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border/40 bg-muted/10 text-muted-foreground"
                }`}
              >
                <div>{s.masked_nick ? <Crown className="w-3 h-3" /> : "·"}</div>
                <div className="text-[8px] opacity-70">#{s.seat_no}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
