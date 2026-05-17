/**
 * /phon — PHON 허브 (잔액 · 혜택 · 다음 티어 · 컬렉션)
 *
 * 가상 화폐 PHON의 경제적 가치를 한 화면에 보여주는 페이지.
 * 신규 RPC 없음 — useMyPower 와 기존 컴포넌트 재활용.
 */
import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useMyPower } from "@/hooks/use-my-power";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingList } from "@/components/ui/loading-state";
import { Coins, Crown, Zap, Sparkles, ArrowRight, TrendingUp, Gift } from "lucide-react";

const PhonAdvantageRibbon = lazy(() => import("@/components/trading/v3/PhonAdvantageRibbon"));
const EmpireCollection = lazy(() => import("@/pages/EmpireCollection"));
const PhonEconomyExplainer = lazy(() => import("@/components/phon/PhonEconomyExplainer"));
const PhonSwapBridge = lazy(() => import("@/components/phon/PhonSwapBridge"));
const PhonStakingComingSoon = lazy(() => import("@/components/phon/PhonStakingComingSoon"));

function fmt(n: number) {
  return new Intl.NumberFormat("ko-KR").format(Math.floor(n));
}

function PhonHero() {
  const { phon, maxLeverage, boostPct, loading } = useMyPower();
  if (loading) return <LoadingList rows={2} />;
  return (
    <Card className="relative overflow-hidden rounded-2xl border-pink/30 bg-gradient-to-br from-primary/10 via-card/60 to-pink/10 p-6">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-pink/5 pointer-events-none" />
      <div className="relative">
        <div className="text-[11px] tracking-[0.3em] font-black text-pink uppercase mb-2">
          나의 PHON 자산
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-imperial text-4xl md:text-5xl text-gradient-imperial tabular-nums">
            {fmt(phon)}
          </span>
          <span className="text-lg font-bold text-primary/80">PHON</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl glass border border-border/40 p-3">
            <div className="text-[10px] tracking-widest text-muted-foreground mb-1">최대 레버리지</div>
            <div className="font-imperial text-xl text-pink">{maxLeverage}x</div>
          </div>
          <div className="rounded-xl glass border border-border/40 p-3">
            <div className="text-[10px] tracking-widest text-muted-foreground mb-1">NFT 부스트</div>
            <div className="font-imperial text-xl text-primary">+{boostPct}%</div>
          </div>
        </div>
      </div>
    </Card>
  );
}

const BENEFITS = [
  { icon: Zap, title: "수수료 20% 할인", desc: "PHON으로 베팅하면 하우스 에지가 즉시 줄어듭니다.", accent: "from-primary/15 to-amber-500/5 border-primary/40" },
  { icon: TrendingUp, title: "레버리지 최대 100x", desc: "보유 PHON 만큼 트레이딩 한도가 자동 상승합니다.", accent: "from-pink/15 to-rose-500/5 border-pink/40" },
  { icon: Crown, title: "Crown 보상 ×1.5", desc: "Empire Booster 활성 시 모든 Crown 획득량 증가.", accent: "from-violet-500/15 to-fuchsia-500/5 border-violet-500/40" },
  { icon: Gift, title: "첫 입금 +10% 보너스", desc: "최초 코인 입금 시 PHON 10%가 즉시 추가됩니다.", accent: "from-emerald-500/15 to-teal-500/5 border-emerald-500/40" },
];

function PhonBenefitsGrid() {
  return (
    <div>
      <div className="text-[11px] tracking-[0.3em] font-black text-foreground/70 uppercase mb-3 px-1">
        PHON 경제 혜택
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {BENEFITS.map((b) => {
          const Icon = b.icon;
          return (
            <div
              key={b.title}
              className={`rounded-2xl border bg-gradient-to-br ${b.accent} p-4`}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl glass border border-border/40 flex items-center justify-center text-pink shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-imperial text-base text-foreground leading-tight">{b.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">{b.desc}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NextTierProgress() {
  const { phon, nextThreshold } = useMyPower();
  if (!nextThreshold) {
    return (
      <Card className="rounded-2xl border-primary/30 bg-card/60 p-5">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="w-4 h-4" />
          <span className="font-imperial">최고 등급 도달 — 폐하의 자리가 굳건합니다.</span>
        </div>
      </Card>
    );
  }
  const need = Math.max(0, (nextThreshold as any).need_phon ?? 0);
  const targetLabel = (nextThreshold as any).next_label ?? "다음 등급";
  const pct = need > 0 ? Math.min(100, (phon / (phon + need)) * 100) : 100;
  return (
    <Card className="rounded-2xl border-pink/30 bg-card/60 p-5">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-[11px] tracking-[0.3em] font-black text-pink uppercase">다음 티어까지</div>
        <div className="text-sm text-muted-foreground">{targetLabel}</div>
      </div>
      <div className="font-imperial text-2xl text-foreground tabular-nums">
        +{fmt(need)} <span className="text-base text-muted-foreground">PHON</span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-muted/40 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-pink transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <Link to="/wallet?tab=deposit">
        <Button className="mt-4 w-full bg-gradient-to-r from-primary to-pink text-primary-foreground font-bold min-h-12">
          지금 입금하고 등급 올리기 <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </Link>
    </Card>
  );
}

function ComingSoonCard() {
  return (
    <Card className="rounded-2xl border-dashed border-border/60 bg-card/30 p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Coins className="w-4 h-4 text-primary" />
        <span className="font-imperial text-sm">스왑 · 스테이킹 · 일일 배당</span>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        PHON 경제의 다음 장(章)이 곧 열립니다. 폐하의 자리는 그대로 유지됩니다.
      </div>
    </Card>
  );
}

export default function PhonHub() {
  const user = useRequireAuth();
  if (!user) return null;

  return (
    <Layout>
      <div className="container py-5 space-y-5 max-w-3xl">
        <div className="flex items-baseline gap-3">
          <h1 className="font-imperial text-2xl md:text-3xl text-gradient-imperial tracking-[0.18em]">
            PHON
          </h1>
          <span className="text-[11px] text-muted-foreground tracking-wide">
            폐하의 황금 자산
          </span>
        </div>

        <PhonHero />

        <Suspense fallback={null}>
          <PhonAdvantageRibbon />
        </Suspense>

        <PhonBenefitsGrid />

        <NextTierProgress />

        <ComingSoonCard />

        <div>
          <div className="text-[11px] tracking-[0.3em] font-black text-foreground/70 uppercase mb-3 px-1">
            나의 NFT 컬렉션
          </div>
          <Suspense fallback={<LoadingList rows={3} />}>
            <EmpireCollection />
          </Suspense>
        </div>
      </div>
    </Layout>
  );
}
