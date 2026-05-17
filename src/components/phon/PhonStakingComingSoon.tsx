/**
 * PhonStakingComingSoon — 스테이킹 사전 안내 카드.
 *
 * 가짜 잔액 mutation 없음. 사전 등록(localStorage) 만 수집.
 */
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Check } from "lucide-react";
import {
  PHON_STAKING_APY_RANGE,
  PHON_STAKING_DAILY_YIELD_PREVIEW,
  previewDailyYieldPhon,
} from "@/lib/phonEconomy";
import { useMyPower } from "@/hooks/use-my-power";

const LS_KEY = "phonara:phon_staking_waitlist:v1";

export default function PhonStakingComingSoon() {
  const { phon } = useMyPower();
  const [joined, setJoined] = useState(false);
  useEffect(() => {
    try { setJoined(localStorage.getItem(LS_KEY) === "1"); } catch {}
  }, []);

  const sample = phon > 0 ? phon : 10_000;
  const dailyPreview = previewDailyYieldPhon(sample);

  function join() {
    try { localStorage.setItem(LS_KEY, "1"); } catch {}
    setJoined(true);
  }

  return (
    <Card className="relative overflow-hidden rounded-2xl border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-card/60 to-teal-500/5 p-5">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-[11px] tracking-[0.3em] font-black text-emerald-400 uppercase">
          PHON 스테이킹
        </div>
        <span className="text-[10px] text-muted-foreground">곧 공개</span>
      </div>

      <div className="font-imperial text-xl text-foreground leading-tight">
        매일 받는 황실의 배당
      </div>
      <div className="text-xs text-muted-foreground mt-1">
        예상 APY <span className="text-emerald-400 font-bold">
          {Math.round(PHON_STAKING_APY_RANGE.min * 100)}~{Math.round(PHON_STAKING_APY_RANGE.max * 100)}%
        </span>
        {" "}· 플랫폼 수익 일일 {(PHON_STAKING_DAILY_YIELD_PREVIEW * 100).toFixed(1)}% 분배 예정
      </div>

      <div className="mt-4 rounded-xl glass border border-border/40 p-3">
        <div className="text-[10px] tracking-widest text-muted-foreground mb-1">
          {phon > 0 ? "내 PHON 기준 예상" : "10,000 PHON 기준 예상"}
        </div>
        <div className="font-imperial text-lg text-emerald-400 tabular-nums">
          +{dailyPreview.toLocaleString("ko-KR")} PHON / 일
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5">
          ※ 예상치이며, 실제 정산은 공개 시점의 정책을 따릅니다.
        </div>
      </div>

      <Button
        onClick={join}
        disabled={joined}
        className={`mt-4 w-full min-h-12 font-bold ${
          joined
            ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 cursor-default"
            : "bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
        }`}
      >
        {joined ? (
          <><Check className="w-4 h-4 mr-1" /> 사전 알림 신청 완료</>
        ) : (
          <><Sparkles className="w-4 h-4 mr-1" /> 공개되면 가장 먼저 알려주세요</>
        )}
      </Button>
    </Card>
  );
}
