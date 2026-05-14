import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Crown, Rocket, Globe, Zap } from "lucide-react";
import { LuxButton } from "@/components/ui/lux";
import { track } from "@/lib/telemetry";
import { submitPackagePurchase } from "@/lib/packages-rpc";
import { notify } from "@/lib/notify";

export type CosmosPkg = {
  id: string;
  emoji: string;
  name: string;
  tagline: string;
  priceUsd: number;
  dailyPct: number;
  durationDays: number;
  unlocks: string[];
  seatLimit?: number;
  seatTakenStart?: number;
  accent: "earth" | "mars" | "galaxy";
};

const COSMOS_PACKAGES: CosmosPkg[] = [
  {
    id: "cosmos_earth",
    emoji: "🌍",
    name: "Earth Starter",
    tagline: "지구 출발 — 첫 식민지의 시작",
    priceUsd: 300,
    dailyPct: 1.5,
    durationDays: 30,
    unlocks: ["🏅 Bronze Crown NFT 즉시 발급", "🎰 슬롯 10회/일 무료", "⚡ 첫 3일 +0.5% 가속 부스트"],
    accent: "earth",
  },
  {
    id: "cosmos_mars",
    emoji: "🪐",
    name: "Mars Colony",
    tagline: "화성 식민지 — 레버리지 25× 잠금해제",
    priceUsd: 3000,
    dailyPct: 2.0,
    durationDays: 30,
    unlocks: [
      "🥇 Gold Crown NFT 즉시 발급",
      "🚀 레버리지 25× 잠금해제",
      "⚡ 30일 Empire Booster",
      "💎 PHON 결제 시 -20% 할인",
    ],
    accent: "mars",
  },
  {
    id: "cosmos_galaxy",
    emoji: "🌌",
    name: "Galaxy Emperor",
    tagline: "은하 황제 — 시즌당 100석 한정",
    priceUsd: 30000,
    dailyPct: 2.8,
    durationDays: 30,
    unlocks: [
      "💠 Diamond Crown NFT 즉시 발급",
      "👑 Baron 즉시 승급",
      "🔥 Crown ×2 영구 부스트",
      "🏛️ Founding Seat 우선권",
      "🛰️ Empire Rocket Stack 스킨",
      "💬 관리자 채팅 우선 응답",
    ],
    seatLimit: 100,
    seatTakenStart: 7,
    accent: "galaxy",
  },
];

export { COSMOS_PACKAGES };

const ACCENTS: Record<CosmosPkg["accent"], { ring: string; bg: string; chip: string; glow: string; icon: React.ElementType }> = {
  earth: {
    ring: "from-emerald-400 via-cyan-400 to-blue-500",
    bg: "from-emerald-500/15 via-cyan-500/10 to-transparent",
    chip: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    glow: "shadow-[0_20px_80px_-20px_hsl(var(--secondary)/0.5)]",
    icon: Globe,
  },
  mars: {
    ring: "from-orange-500 via-rose-500 to-amber-500",
    bg: "from-orange-500/15 via-rose-500/10 to-transparent",
    chip: "bg-orange-500/20 text-orange-300 border-orange-500/40",
    glow: "shadow-[0_20px_80px_-20px_hsl(20_90%_50%/0.5)]",
    icon: Rocket,
  },
  galaxy: {
    ring: "from-violet-500 via-fuchsia-500 to-gold",
    bg: "from-violet-500/20 via-fuchsia-500/15 to-gold/15",
    chip: "bg-gold/20 text-gold border-gold/50",
    glow: "shadow-[0_30px_100px_-20px_hsl(var(--gold)/0.6)]",
    icon: Crown,
  },
};

export function CosmosPackageCard({ pkg, onPurchaseSubmitted }: { pkg: CosmosPkg; onPurchaseSubmitted?: () => void }) {
  const accent = ACCENTS[pkg.accent];
  const Icon = accent.icon;
  const [busy, setBusy] = useState(false);
  const totalReturn = Math.round(pkg.priceUsd * (pkg.dailyPct / 100) * pkg.durationDays);
  const seatsLeft = pkg.seatLimit ? Math.max(0, pkg.seatLimit - (pkg.seatTakenStart ?? 0)) : null;
  const isLimited = seatsLeft !== null;
  // KRW conversion for legacy backend (₩1,360/USDT approx)
  const priceKrw = Math.round(pkg.priceUsd * 1360);
  const dailyKrw = Math.round((priceKrw * pkg.dailyPct) / 100);

  async function handleSubscribe() {
    if (busy) return;
    setBusy(true);
    track("cta_click", { surface: "cosmos_pkg", variant: pkg.id, meta: { price_usd: pkg.priceUsd } });
    try {
      await submitPackagePurchase({
        packageId: pkg.id,
        packageName: pkg.name,
        amount: priceKrw,
        dailyReturn: dailyKrw,
        durationDays: pkg.durationDays,
        totalReturn: priceKrw + Math.round(totalReturn * 1360),
      });
      notify.success("Cosmos 구독 신청 접수", { description: `${pkg.name} — 입금 확인 후 자동 활성화됩니다.` });
      onPurchaseSubmitted?.();
    } catch (e: any) {
      notify.error("구독 신청 실패", { description: e?.message ?? "다시 시도해 주세요." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`relative group rounded-3xl overflow-hidden ${accent.glow}`}
      aria-label={`${pkg.name} Cosmos 패키지`}
    >
      <div aria-hidden className={`absolute -inset-0.5 rounded-3xl bg-gradient-to-br ${accent.ring} opacity-60 blur-md group-hover:opacity-100 transition duration-700`} />
      <div className="relative glass-strong rounded-3xl p-5 sm:p-6 border border-border/50">
        <div aria-hidden className={`pointer-events-none absolute -top-20 -right-20 w-44 h-44 rounded-full bg-gradient-to-br ${accent.bg} to-transparent blur-3xl opacity-80`} />
        {pkg.accent === "galaxy" && (
          <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <span key={i} className="absolute text-gold animate-crown text-sm" style={{ left: `${5 + i * 12}%`, top: `${10 + (i % 3) * 25}%`, animationDelay: `${i * 0.25}s` }}>
                ✦
              </span>
            ))}
          </div>
        )}

        <div className="relative">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 text-[10px] tracking-widest font-imperial font-black px-2.5 py-1 rounded-full border ${accent.chip}`}>
              <Icon className="w-3 h-3" />
              COSMOS · {pkg.accent.toUpperCase()}
            </span>
            {isLimited && (
              <span className="inline-flex items-center gap-1 text-[10px] font-black text-gold animate-pulse">
                <Sparkles className="w-3 h-3" />
                시즌당 {pkg.seatLimit}석 한정 · {seatsLeft}석 남음
              </span>
            )}
          </div>

          <h3 className="font-imperial font-black text-2xl sm:text-3xl mt-3 tracking-[0.02em]">
            <span className="mr-1.5">{pkg.emoji}</span>
            {pkg.name}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 break-keep">{pkg.tagline}</p>

          {/* price stats */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Stat label="가격" value={`$${pkg.priceUsd.toLocaleString()}`} sub="USDT" />
            <Stat label="일수익" value={`${pkg.dailyPct.toFixed(1)}%`} highlight sub={`${pkg.durationDays}일`} />
            <Stat label="총수익" value={`+${(pkg.dailyPct * pkg.durationDays).toFixed(0)}%`} highlight sub={`$${totalReturn.toLocaleString()}`} />
          </div>

          {/* unlocks (the actual hook) */}
          <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-3.5">
            <div className="flex items-center gap-1.5 text-[10px] tracking-[0.25em] font-black text-primary/90 mb-2">
              <Zap className="w-3 h-3" />
              잠금해제되는 권한
            </div>
            <ul className="space-y-1.5">
              {pkg.unlocks.map((u) => (
                <li key={u} className="text-xs sm:text-sm font-bold break-keep flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">▸</span>
                  <span>{u}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* seats progress */}
          {isLimited && (
            <div className="mt-3">
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                <span>좌석 잔량</span>
                <span className="text-gold font-bold tabular-nums">{seatsLeft} / {pkg.seatLimit}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-gold via-amber-300 to-gold animate-pulse" style={{ width: `${(seatsLeft! / pkg.seatLimit!) * 100}%` }} />
              </div>
            </div>
          )}

          <LuxButton onClick={handleSubscribe} disabled={busy} block size="lg" className="mt-5 sheen">
            <Sparkles className="w-4 h-4" />
            {busy ? "신청 중…" : pkg.accent === "galaxy" ? "황제 좌석 신청" : pkg.accent === "mars" ? "화성 식민지 건설" : "지구 항해 시작"}
          </LuxButton>

          <p className="mt-2 text-[10px] text-muted-foreground/80 leading-relaxed">
            * 표시 가격은 USDT 기준 · 결제는 원화/코인 모두 가능 · 입금 확인 후 즉시 권한 활성화
          </p>
        </div>
      </div>
    </motion.article>
  );
}

function Stat({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className="glass rounded-xl p-2.5 text-center">
      <div className="text-[9px] text-muted-foreground tracking-wide">{label}</div>
      <div className={`font-imperial font-black text-base mt-0.5 tabular-nums ${highlight ? "text-money-strong" : ""}`}>{value}</div>
      {sub && <div className="text-[9px] text-muted-foreground/70 mt-0.5 tabular-nums">{sub}</div>}
    </div>
  );
}

export default CosmosPackageCard;
