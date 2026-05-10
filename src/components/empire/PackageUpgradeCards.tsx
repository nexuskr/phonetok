import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Lock, Sparkles, TrendingUp, Shield, Zap, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { Card } from "@/components/ui/card";
import { LoadingList } from "@/components/ui/loading-state";
import { notify } from "@/lib/notify";

type EmpireUnit = {
  id: string;
  tier: string;
  level: number;
  xp: number;
  stats: Record<string, any> | null;
  acquired_at: string;
};

type TierMeta = {
  key: string;
  name: string;
  rarity: "Common" | "Rare" | "Epic" | "Legendary" | "Mythic";
  emblem: string;
  color: string;
  glow: string;
  territoryBonus: number;
  recoveryBonus: number;
  description: string;
  unlockHint: string;
};

const TIERS: TierMeta[] = [
  {
    key: "free",
    name: "신병 군주",
    rarity: "Common",
    emblem: "⚔️",
    color: "from-muted/30 to-muted/10",
    glow: "shadow-none",
    territoryBonus: 1,
    recoveryBonus: 5,
    description: "제국 입문 카드 — 기본 영토 +1%",
    unlockHint: "가입 즉시 자동 지급",
  },
  {
    key: "easy_starter",
    name: "이지 스타터",
    rarity: "Rare",
    emblem: "🛡️",
    color: "from-primary/20 to-primary/5",
    glow: "shadow-[0_0_20px_-8px_hsl(var(--primary)/0.4)]",
    territoryBonus: 3,
    recoveryBonus: 15,
    description: "첫 입금 보상 — Recovery +15%",
    unlockHint: "Empire Package 입금 시 진화",
  },
  {
    key: "easy_50",
    name: "이지 50",
    rarity: "Rare",
    emblem: "🏹",
    color: "from-primary/30 to-accent/10",
    glow: "shadow-[0_0_24px_-6px_hsl(var(--primary)/0.5)]",
    territoryBonus: 6,
    recoveryBonus: 25,
    description: "중급 군주 — Recovery +25% + 길드 보너스",
    unlockHint: "50만원 패키지로 진화",
  },
  {
    key: "easy_150",
    name: "이지 150",
    rarity: "Epic",
    emblem: "🦅",
    color: "from-accent/30 to-primary/15",
    glow: "shadow-[0_0_28px_-4px_hsl(var(--accent)/0.55)]",
    territoryBonus: 10,
    recoveryBonus: 40,
    description: "에픽 군주 — Recovery +40% + Jackpot 풀 가중치",
    unlockHint: "150만원 패키지로 진화",
  },
  {
    key: "empire",
    name: "제국 군주",
    rarity: "Legendary",
    emblem: "👑",
    color: "from-gold/40 to-primary/15",
    glow: "shadow-[0_0_36px_-4px_hsl(var(--gold)/0.55)] glow-gold",
    territoryBonus: 15,
    recoveryBonus: 60,
    description: "전설 황제 — 골드 룰렛 + 가챠 + Recovery +60%",
    unlockHint: "Empire 패키지로 진화",
  },
  {
    key: "empire_elite",
    name: "제국 엘리트",
    rarity: "Legendary",
    emblem: "🐉",
    color: "from-gold/50 to-destructive/20",
    glow: "shadow-[0_0_40px_-2px_hsl(var(--gold)/0.7)] glow-gold",
    territoryBonus: 22,
    recoveryBonus: 80,
    description: "엘리트 황제 — Recovery +80% + 길드 전쟁 가중치 ×2",
    unlockHint: "Elite 패키지로 진화",
  },
  {
    key: "phantom",
    name: "팬텀 황제",
    rarity: "Mythic",
    emblem: "🌌",
    color: "from-destructive/40 via-gold/40 to-primary/30",
    glow: "shadow-[0_0_50px_0px_hsl(var(--gold)/0.8)] glow-gold",
    territoryBonus: 35,
    recoveryBonus: 100,
    description: "신화 — 명예의 전당 +1티어 + 모든 보너스 최대",
    unlockHint: "Phantom 패키지로 진화 (한정)",
  },
];

const RARITY_BADGE: Record<TierMeta["rarity"], string> = {
  Common: "bg-muted/40 text-muted-foreground",
  Rare: "bg-primary/20 text-primary",
  Epic: "bg-accent/20 text-accent",
  Legendary: "bg-gold/20 text-gold",
  Mythic: "bg-gradient-to-r from-destructive/30 to-gold/30 text-gold",
};

export default function PackageUpgradeCards() {
  const user = useRequireAuth();
  const [units, setUnits] = useState<EmpireUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [evolving, setEvolving] = useState<string | null>(null);
  const [evolvedFlash, setEvolvedFlash] = useState<string | null>(null);

  const ownedByTier = useMemo(() => {
    const m: Record<string, EmpireUnit> = {};
    units.forEach((u) => (m[u.tier] = u));
    return m;
  }, [units]);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("empire_units")
      .select("id, tier, level, xp, stats, acquired_at")
      .eq("user_id", user.id)
      .order("acquired_at", { ascending: true });
    setUnits((data ?? []) as EmpireUnit[]);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, [user?.id]);

  async function handleEvolve(unitId: string, tierKey: string) {
    setEvolving(unitId);
    const { error, data } = await supabase.rpc("evolve_empire_unit", { _unit_id: unitId });
    setEvolving(null);
    if (error) {
      if (error.message.includes("insufficient_xp")) {
        notify.error("XP 부족", { description: "100 XP를 모은 뒤 다시 시도하세요" });
      } else {
        notify.error(`진화 실패: ${error.message}`);
      }
      return;
    }
    const newLevel = (data as any)?.level ?? "?";
    notify.success(`🔥 진화 성공!`, { description: `LV.${newLevel} 도달 — 영토가 확장됩니다` });
    setEvolvedFlash(tierKey);
    setTimeout(() => setEvolvedFlash(null), 1800);
    void load();
  }

  if (loading) {
    return (
      <div className="mb-6">
        <LoadingList rows={4} rowHeight="lg" />
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-imperial font-black text-2xl text-gradient-gold flex items-center gap-2">
            <Crown className="w-6 h-6 text-gold" /> 제국 군주 카드
          </h2>
          <p className="text-[11px] text-muted-foreground mt-1 break-keep">
            카드를 진화시켜 영토와 Recovery 보너스를 확장하세요 (100 XP / 레벨)
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-muted-foreground">보유 유닛</div>
          <div className="font-imperial font-black text-xl text-gold tabular-nums">
            {units.length}/{TIERS.length}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TIERS.map((t, idx) => {
          const owned = ownedByTier[t.key];
          const xpPct = owned ? Math.min(100, (owned.xp / 100) * 100) : 0;
          const canEvolve = owned ? owned.xp >= 100 && owned.level < 100 : false;
          const isEvolving = owned ? evolving === owned.id : false;
          const flashed = evolvedFlash === t.key;

          return (
            <motion.div
              key={t.key}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: flashed ? [1, 1.06, 1] : 1,
              }}
              transition={{ delay: idx * 0.04, scale: { duration: 1.2 } }}
              className="relative"
            >
              <Card
                className={`relative overflow-hidden border-2 p-0 bg-gradient-to-br ${t.color} ${
                  owned ? `border-gold/30 ${t.glow}` : "border-border/30 opacity-80"
                } ${flashed ? "border-gold animate-pulse" : ""}`}
              >
                {/* Locked overlay */}
                {!owned && (
                  <div className="absolute top-2 right-2 z-10 rounded-full bg-background/70 backdrop-blur-md p-1.5">
                    <Lock className="w-3 h-3 text-muted-foreground" />
                  </div>
                )}

                {/* Rarity badge */}
                <div className="absolute top-2 left-2 z-10">
                  <span
                    className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${RARITY_BADGE[t.rarity]}`}
                  >
                    {t.rarity}
                  </span>
                </div>

                {/* Emblem with evolution animation */}
                <div className="relative h-32 grid place-items-center overflow-hidden">
                  <motion.div
                    animate={
                      owned
                        ? { y: [0, -6, 0], rotate: flashed ? [0, -12, 12, 0] : 0 }
                        : {}
                    }
                    transition={{ duration: flashed ? 1.4 : 3, repeat: flashed ? 0 : Infinity }}
                    className="text-7xl drop-shadow-2xl"
                    style={{
                      filter: owned ? "drop-shadow(0 0 16px hsl(var(--gold)/0.5))" : "grayscale(0.6)",
                    }}
                  >
                    {t.emblem}
                  </motion.div>
                  {/* particle burst on evolution */}
                  <AnimatePresence>
                    {flashed && (
                      <div className="absolute inset-0 pointer-events-none">
                        {Array.from({ length: 14 }).map((_, i) => (
                          <motion.span
                            key={i}
                            className="absolute left-1/2 top-1/2 w-1 h-1 rounded-full bg-gold"
                            initial={{ x: 0, y: 0, opacity: 1 }}
                            animate={{
                              x: Math.cos((i / 14) * Math.PI * 2) * 80,
                              y: Math.sin((i / 14) * Math.PI * 2) * 80,
                              opacity: 0,
                            }}
                            transition={{ duration: 1.2, delay: i * 0.02 }}
                            style={{ boxShadow: "0 0 8px hsl(var(--gold))" }}
                          />
                        ))}
                      </div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Content */}
                <div className="p-4 pt-2 space-y-3">
                  <div>
                    <div className="font-imperial font-black text-lg break-keep">{t.name}</div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed break-keep">
                      {t.description}
                    </p>
                  </div>

                  {/* Stats preview */}
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="glass rounded-lg px-2 py-1.5 flex items-center gap-1.5">
                      <TrendingUp className="w-3 h-3 text-secondary shrink-0" />
                      <div className="min-w-0">
                        <div className="text-muted-foreground">영토</div>
                        <div className="font-black text-secondary tabular-nums">+{t.territoryBonus}%</div>
                      </div>
                    </div>
                    <div className="glass rounded-lg px-2 py-1.5 flex items-center gap-1.5">
                      <Shield className="w-3 h-3 text-gold shrink-0" />
                      <div className="min-w-0">
                        <div className="text-muted-foreground">Recovery</div>
                        <div className="font-black text-gold tabular-nums">+{t.recoveryBonus}%</div>
                      </div>
                    </div>
                  </div>

                  {/* Level + XP / Lock state */}
                  {owned ? (
                    <>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">레벨</span>
                        <span className="font-imperial font-black text-base text-gold tabular-nums">
                          LV.{owned.level}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-[10px] mb-1">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Zap className="w-3 h-3" /> XP
                          </span>
                          <span className="tabular-nums">{owned.xp}/100</span>
                        </div>
                        <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-gradient-gold"
                            initial={{ width: 0 }}
                            animate={{ width: `${xpPct}%` }}
                            transition={{ duration: 0.6 }}
                          />
                        </div>
                      </div>
                      <button
                        disabled={!canEvolve || isEvolving}
                        onClick={() => handleEvolve(owned.id, t.key)}
                        className={`w-full py-2.5 rounded-xl font-imperial font-black text-sm transition-all ${
                          canEvolve
                            ? "bg-gradient-gold text-gold-foreground hover:scale-[1.02] glow-gold"
                            : "bg-muted/30 text-muted-foreground cursor-not-allowed"
                        }`}
                      >
                        {isEvolving ? (
                          <span className="flex items-center justify-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 animate-spin" /> 진화 중...
                          </span>
                        ) : canEvolve ? (
                          <span className="flex items-center justify-center gap-1">
                            <ChevronUp className="w-4 h-4" /> 진화 (100 XP)
                          </span>
                        ) : (
                          `XP ${owned.xp}/100 모으는 중`
                        )}
                      </button>
                    </>
                  ) : (
                    <div className="rounded-xl border border-dashed border-gold/30 p-3 text-center">
                      <div className="text-[10px] text-muted-foreground mb-1 break-keep">{t.unlockHint}</div>
                      <div className="text-[10px] font-black text-gold/70">미션·잭팟으로 해금 진행</div>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
