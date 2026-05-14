import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Zap, ExternalLink } from "lucide-react";

type Row = {
  competitor: string;
  metric_key: string;
  metric_value: number;
  unit: string | null;
  source_url: string;
  source_label: string | null;
};

// Phonara 자체 기준치 (현재 운영 평균 — 추후 실측 RPC로 교체)
const PHONARA = {
  avg_withdrawal_minutes: 4,   // 4분 평균 (loss_protection/trust 페이지 기준)
  taker_fee_pct: 0.05,         // 0.05%
};

function buildCompare(rows: Row[]) {
  const out: { metric: string; phonara: string; competitor: string; multiplier: string; source: string; sourceLabel: string }[] = [];
  const wd = rows.filter((r) => r.metric_key === "avg_withdrawal_minutes");
  if (wd.length) {
    const avg = wd.reduce((s, r) => s + Number(r.metric_value), 0) / wd.length;
    const mult = (avg / PHONARA.avg_withdrawal_minutes).toFixed(0);
    out.push({
      metric: "출금 속도",
      phonara: `${PHONARA.avg_withdrawal_minutes}분`,
      competitor: `평균 ${Math.round(avg)}분`,
      multiplier: `${mult}× FASTER`,
      source: wd[0].source_url,
      sourceLabel: wd[0].source_label ?? "Source",
    });
  }
  const fee = rows.filter((r) => r.metric_key === "taker_fee_pct");
  if (fee.length) {
    const min = Math.min(...fee.map((r) => Number(r.metric_value)));
    const mult = (min / PHONARA.taker_fee_pct).toFixed(0);
    out.push({
      metric: "수수료",
      phonara: `${PHONARA.taker_fee_pct}%`,
      competitor: `최저 ${min}%`,
      multiplier: `${mult}× CHEAPER`,
      source: fee[0].source_url,
      sourceLabel: fee[0].source_label ?? "Source",
    });
  }
  return out;
}

export default function CompetitorCompareTicker() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    let alive = true;
    supabase.rpc("get_competitor_compare" as any).then(({ data }) => {
      if (alive && Array.isArray(data)) setRows(data as Row[]);
    });
    return () => { alive = false; };
  }, []);

  const cards = useMemo(() => buildCompare(rows), [rows]);

  if (cards.length === 0) return null;

  return (
    <div className="rounded-md bg-card/30 border border-border/40 px-3 py-2">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Zap className="w-3 h-3 text-amber-300" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          vs CEX 비교 (공개 데이터 기준)
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {cards.map((c, i) => (
          <motion.div
            key={c.metric}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center gap-2 text-xs"
          >
            <span className="text-muted-foreground min-w-[60px]">{c.metric}</span>
            <span className="font-bold text-emerald-300 tabular-nums">{c.phonara}</span>
            <span className="text-muted-foreground">vs</span>
            <span className="text-rose-300/80 tabular-nums">{c.competitor}</span>
            <span className="ml-auto text-[10px] font-black text-amber-300 tracking-wider">
              {c.multiplier}
            </span>
            <a
              href={c.source}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-muted-foreground hover:text-foreground"
              title={c.sourceLabel}
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
