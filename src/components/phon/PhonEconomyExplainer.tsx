/**
 * PhonEconomyExplainer — PHON 의 4가지 경제 가치를 한 화면에.
 *
 * Pass 1 표시 전용. 실제 할인/배당 정산은 Pass 2 PR.
 */
import { Zap, TrendingUp, Crown, Gift } from "lucide-react";
import { HOUSE_EDGE_DISCOUNT_RATE, PHON_STAKING_APY_RANGE } from "@/lib/phonEconomy";

const PILLARS = [
  {
    icon: Zap,
    title: `수수료 ${Math.round(HOUSE_EDGE_DISCOUNT_RATE * 100)}% 할인`,
    desc: "PHON으로 베팅하면 하우스 에지가 즉시 줄어듭니다. 폐하의 수익이 더 두꺼워집니다.",
    accent: "from-primary/15 to-amber-500/5 border-primary/40",
    badge: "곧 적용",
  },
  {
    icon: TrendingUp,
    title: "레버리지 최대 100x",
    desc: "PHON 보유량이 곧 자격입니다. 보유한 만큼 트레이딩 한도가 자동으로 올라갑니다.",
    accent: "from-pink/15 to-rose-500/5 border-pink/40",
    badge: "지금 적용 중",
  },
  {
    icon: Crown,
    title: "Crown 보상 ×1.5",
    desc: "Empire Booster 활성 시 모든 Crown 획득량이 증가합니다. 등급 상승이 가속됩니다.",
    accent: "from-violet-500/15 to-fuchsia-500/5 border-violet-500/40",
    badge: "지금 적용 중",
  },
  {
    icon: Gift,
    title: `스테이킹 예상 APY ${Math.round(PHON_STAKING_APY_RANGE.min * 100)}~${Math.round(PHON_STAKING_APY_RANGE.max * 100)}%`,
    desc: "PHON 을 맡겨두면 플랫폼 수익을 매일 나눠 받습니다. 폐하의 금고가 잠들지 않습니다.",
    accent: "from-emerald-500/15 to-teal-500/5 border-emerald-500/40",
    badge: "곧 적용",
  },
] as const;

export default function PhonEconomyExplainer() {
  return (
    <div>
      <div className="text-[11px] tracking-[0.3em] font-black text-foreground/70 uppercase mb-3 px-1">
        PHON 의 경제 가치
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PILLARS.map((p) => {
          const Icon = p.icon;
          const isLive = p.badge === "지금 적용 중";
          return (
            <div
              key={p.title}
              className={`relative rounded-2xl border bg-gradient-to-br ${p.accent} p-4`}
            >
              <span
                className={`absolute top-3 right-3 text-[9px] tracking-widest font-black px-2 py-0.5 rounded-full ${
                  isLive
                    ? "bg-primary/20 text-primary border border-primary/40"
                    : "bg-pink/10 text-pink border border-pink/40"
                }`}
              >
                {p.badge.toUpperCase()}
              </span>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl glass border border-border/40 flex items-center justify-center text-pink shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0 pr-14">
                  <div className="font-imperial text-base text-foreground leading-tight">
                    {p.title}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{p.desc}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
