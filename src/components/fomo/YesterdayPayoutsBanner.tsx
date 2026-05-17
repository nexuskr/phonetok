import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Crown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FOMO } from "@/lib/glossary";

/**
 * YesterdayPayoutsBanner — Phase E Slice 4.
 *
 * Warm Gold Imperial 1줄 배너. 어제(KST) `completed_at` 기준 출금 인원수를
 * 기존 공개 RPC `get_recent_payouts_100`에서 집계해 렌더한다.
 * 신규 RPC/마이그레이션 없음. 5분 sessionStorage 캐시.
 */
const CACHE_KEY = "phonara:yesterday_payouts:v1";
const TTL_MS = 5 * 60 * 1000;

function kstYesterdayYmd(): string {
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 3600 * 1000);
  kstNow.setUTCDate(kstNow.getUTCDate() - 1);
  return kstNow.toISOString().slice(0, 10); // YYYY-MM-DD
}

function kstYmd(iso: string): string {
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10);
}

export default function YesterdayPayoutsBanner() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const { ts, n } = JSON.parse(raw) as { ts: number; n: number };
        if (Date.now() - ts < TTL_MS) {
          setCount(n);
          return;
        }
      }
    } catch {}
    (async () => {
      try {
        const { data, error } = await supabase.rpc("get_recent_payouts_100");
        if (error || cancelled) return;
        const ymd = kstYesterdayYmd();
        const n = (data ?? []).filter(
          (r: any) => r?.completed_at && kstYmd(r.completed_at) === ymd,
        ).length;
        if (cancelled) return;
        setCount(n);
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), n }));
        } catch {}
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!count || count <= 0) return null;

  return (
    <Link
      to="/trust"
      style={{ contain: "layout paint" }}
      className="imperial-card imperial-card-hover imperial-corner-shine group relative flex items-center gap-2 px-3 py-2 text-[12px] will-change-transform overflow-hidden"
      aria-label="어제 출금 완료 인원"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "linear-gradient(100deg, hsl(38 92% 55% / 0.18) 0%, hsl(330 85% 60% / 0.08) 60%, transparent 100%)",
        }}
      />
      <Crown className="relative z-10 w-3.5 h-3.5 text-amber-300 shrink-0 drop-shadow-[0_0_4px_hsl(38_92%_55%/0.7)]" />
      <span className="relative z-10 text-amber-100/95 leading-snug font-medium">
        {FOMO.yesterdayPayouts(count)}
      </span>
      <ChevronRight className="relative z-10 ml-auto w-3.5 h-3.5 text-amber-200/70 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
