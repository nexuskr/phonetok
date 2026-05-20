import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Flame, Zap, Sparkles } from "lucide-react";

type Row = {
  amount: number;
  created_at: string;
  flag: string;
  kind: string;
  title: string;
  user_mask: string;
};

function iconFor(kind: string) {
  if (kind?.includes("baron") || kind?.includes("vip")) return <Flame className="w-3.5 h-3.5 text-pink-400" />;
  if (kind?.includes("withdraw")) return <Zap className="w-3.5 h-3.5 text-emerald-300" />;
  if (kind?.includes("win") || kind?.includes("payout")) return <Sparkles className="w-3.5 h-3.5 text-amber-300" />;
  return <TrendingUp className="w-3.5 h-3.5 text-amber-300" />;
}

function fmt(n: number) {
  if (!n) return "0";
  if (n >= 1e8) return `${(n / 1e8).toFixed(1)}억`;
  if (n >= 1e4) return `${(n / 1e4).toFixed(1)}만`;
  return n.toLocaleString();
}

function timeAgo(iso: string) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m`;
}

export default function LiveBetFeed() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const seenKey = useRef<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase.rpc("get_live_activity_60s", { _limit: 24 });
      if (!alive) return;
      const next = (data as Row[] | null) ?? [];
      setRows(next);
      setLoaded(true);
    };
    load();
    const t = window.setInterval(load, 1800);
    return () => { alive = false; window.clearInterval(t); };
  }, []);

  return (
    <section className="w-full max-w-5xl mx-auto px-4 my-6">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
          </span>
          <h2 className="text-sm font-black tracking-[0.18em] text-foreground/90">
            LIVE 베팅 피드
          </h2>
        </div>
        <span className="text-[10px] text-muted-foreground tracking-widest">1.8s 갱신</span>
      </div>

      <div className="relative rounded-2xl border border-amber-300/20 bg-gradient-to-br from-background/80 to-card/40 backdrop-blur p-2 max-h-[320px] overflow-y-auto no-scrollbar">
        {!loaded ? (
          <ul className="space-y-1" aria-hidden>
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="h-10 rounded-xl bg-card/40 border border-border/20 animate-pulse" />
            ))}
          </ul>
        ) : rows.length === 0 ? (
          <div className="py-6 text-center text-[11px] text-muted-foreground">
            지금 활성 사용자가 모이는 중이에요 · 잠시 후 다시 표시됩니다
          </div>
        ) : (
          <ul className="space-y-1">
            {rows.map((r, i) => {
              const k = `${r.created_at}-${r.user_mask}-${r.kind}`;
              const isNew = !seenKey.current.has(k);
              if (isNew) seenKey.current.add(k);
              return (
                <li
                  key={k}
                  style={{
                    animation: isNew ? "live-slide-in 320ms cubic-bezier(.2,.8,.2,1)" : undefined,
                  }}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-card/40 border border-border/30 hover:border-amber-300/40 transition"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {iconFor(r.kind)}
                    <span className="text-xs font-bold text-foreground/90 truncate max-w-[6.5rem]">{r.user_mask}</span>
                    <span className="text-[11px] text-muted-foreground truncate">{r.title}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-muted-foreground/70 tabular-nums">{timeAgo(r.created_at)}</span>
                    <span className="text-xs font-black tabular-nums text-amber-300">
                      {fmt(Number(r.amount) || 0)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <style>{`
        @keyframes live-slide-in {
          from { opacity: 0; transform: translateY(-6px) scale(0.985); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </section>
  );
}
