/**
 * PhonBettingNudge — 트레이딩 패널 위 PHON 베팅 가치 한 줄.
 * 표시 전용. 실제 할인 정산은 Pass 2.
 */
import { Link } from "react-router-dom";
import { Sparkles, ArrowRight } from "lucide-react";
import { useMyPower } from "@/hooks/use-my-power";
import { HOUSE_EDGE_DISCOUNT_RATE } from "@/lib/phonEconomy";

export default function PhonBettingNudge() {
  const { phon, maxLeverage, loading } = useMyPower();
  if (loading) return null;

  const hasPhon = phon > 0;

  return (
    <div className="rounded-2xl border border-primary/40 bg-gradient-to-r from-primary/10 via-pink/5 to-transparent p-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-pink flex items-center justify-center text-primary-foreground shrink-0">
        <Sparkles className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        {hasPhon ? (
          <>
            <div className="text-sm font-bold text-foreground leading-tight">
              폐하의 레버리지 한도 <span className="text-pink">{maxLeverage}x</span>
              <span className="text-muted-foreground font-normal"> · PHON · USDT 모두 지원 · 수수료 {Math.round(HOUSE_EDGE_DISCOUNT_RATE * 100)}% 자동 할인</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              USDT 입력 시 1 USDT = 1,300 PHON 으로 환산되어 즉시 체결됩니다.
            </div>
          </>
        ) : (
          <>
            <div className="text-sm font-bold text-foreground leading-tight">
              <span className="text-primary">PHON · USDT</span> 베팅 모두 지원
              <span className="text-muted-foreground font-normal"> · 레버리지 최대 100x · 수수료 {Math.round(HOUSE_EDGE_DISCOUNT_RATE * 100)}% 즉시 할인</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              지금 PHON 을 확보하시면 폐하의 자리가 한 단계 위로 올라갑니다.
            </div>
          </>
        )}
      </div>
      <Link
        to="/phon"
        className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-primary/20 text-primary text-xs font-bold border border-primary/40 press"
      >
        자세히 <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}
