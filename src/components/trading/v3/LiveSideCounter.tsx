import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useSymbolSideCounts } from "@/hooks/use-hot-symbols";
import { mergeCount, symbolSideFloor } from "@/lib/fakeTradingFloor";

interface Props {
  symbol: string;
}

/**
 * LiveSideCounter — 종목별 롱/숏 인원 실시간 표시 (Global #1 Floor).
 */
export default function LiveSideCounter({ symbol }: Props) {
  const real = useSymbolSideCounts(symbol);
  const [floor, setFloor] = useState(() => symbolSideFloor(symbol));
  useEffect(() => {
    setFloor(symbolSideFloor(symbol));
    const id = window.setInterval(() => setFloor(symbolSideFloor(symbol)), 38_000);
    return () => window.clearInterval(id);
  }, [symbol]);

  const longs = mergeCount(real.longs, floor.longs);
  const shorts = mergeCount(real.shorts, floor.shorts);
  const total = longs + shorts;
  const longPct = total > 0 ? Math.round((longs / total) * 100) : 50;
  const shortPct = 100 - longPct;
  const longLead = longs >= shorts;
  const base = symbol.replace(/USDT$/, "");

  return (
    <div className="rounded-2xl border border-border/40 bg-card/40 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 text-[11px] font-bold mb-1.5">
        <span className={`inline-flex items-center gap-1 ${longLead ? "text-emerald-300" : "text-muted-foreground"}`}>
          <TrendingUp className="w-3 h-3" /> {base} 롱 {longs.toLocaleString("ko-KR")}명
        </span>
        <span className={`inline-flex items-center gap-1 ${!longLead ? "text-rose-300" : "text-muted-foreground"}`}>
          숏 {shorts.toLocaleString("ko-KR")}명 <TrendingDown className="w-3 h-3" />
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden flex bg-muted/30">
        <div
          className="bg-gradient-to-r from-emerald-500 to-emerald-300 transition-[width] duration-700"
          style={{ width: `${longPct}%` }}
        />
        <div
          className="bg-gradient-to-l from-rose-500 to-rose-300 transition-[width] duration-700"
          style={{ width: `${shortPct}%` }}
        />
      </div>
      <div className="mt-1.5 text-[11px] text-muted-foreground text-center">
        현재 <span className="text-foreground font-black tabular-nums">{total.toLocaleString("ko-KR")}명</span>의 황제가 제국에서 실시간으로 <span className="text-amber-200 font-bold">{base}</span> 트레이딩에 참여 중 ·
        {longLead ? " 롱 우세" : " 숏 우세"} <span className="text-amber-300 font-black tabular-nums">{Math.max(longPct, shortPct)}%</span>
      </div>
    </div>
  );
}
