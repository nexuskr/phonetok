import { useState } from "react";
import { Sparkles, RotateCcw } from "lucide-react";

const TIERS = [
  { key: "STARTER", label: "Starter", price: "29,000원", bonusPct: 20 },
  { key: "PRO",     label: "PRO",     price: "300,000원", bonusPct: 30 },
  { key: "VIP",     label: "VIP",     price: "3,000,000원", bonusPct: 40 },
  { key: "GOD",     label: "GOD",     price: "30,000,000원", bonusPct: 50 },
  { key: "EMPIRE",  label: "EMPIRE",  price: "300,000,000원+", bonusPct: 60 },
] as const;

function formatKRW(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

/**
 * Recovery Bonus 실시간 계산기.
 * 청산 이후 재입금 시 등급별 % 즉시 보너스가 어떻게 작동하는지 보여준다.
 * 자금 출처는 Jackpot 풀 잔여분 또는 신규 입금분에서만 충당 — 플랫폼 직접 손실 없음.
 */
export default function RecoveryBonusCalculator() {
  const [amount, setAmount] = useState<number>(1_000_000);
  const [tierKey, setTierKey] = useState<typeof TIERS[number]["key"]>("VIP");
  const tier = TIERS.find(t => t.key === tierKey)!;
  const bonus = Math.floor((amount * tier.bonusPct) / 100);
  const total = amount + bonus;

  return (
    <div className="glass-strong rounded-2xl p-4 my-4 neon-border relative overflow-hidden">
      <div className="flex items-center gap-2 mb-2">
        <RotateCcw className="w-4 h-4 text-gold" />
        <h3 className="font-imperial font-black text-sm text-gradient-gold tracking-[0.04em]">
          Recovery Bonus 계산기
        </h3>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3 break-keep">
        청산 이후 재입금하면 등급별로 즉시 보너스가 추가됩니다.
      </p>

      <label className="block text-[10px] font-bold text-muted-foreground mb-1">재입금 금액 (KRW)</label>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={10000}
        value={amount}
        onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
        className="w-full px-3 py-2.5 rounded-xl glass border border-border/40 focus:border-primary focus:outline-none text-sm tabular-nums"
      />

      <div className="grid grid-cols-5 gap-1 mt-3">
        {TIERS.map((tt) => (
          <button
            key={tt.key}
            onClick={() => setTierKey(tt.key)}
            className={`min-h-[44px] px-1 py-2 rounded-lg text-[10px] font-bold transition break-keep ${
              tierKey === tt.key
                ? "bg-gradient-imperial text-primary-foreground glow-imperial"
                : "glass text-muted-foreground hover:text-foreground border border-border/40"
            }`}
          >
            {tt.label}
            <div className="text-[9px] opacity-80 mt-0.5">+{tt.bonusPct}%</div>
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-gold/30 bg-gradient-to-br from-gold/10 via-transparent to-primary/5 p-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[10px] text-muted-foreground">재입금</span>
          <span className="tabular-nums font-display font-bold">{formatKRW(amount)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-2 mt-1">
          <span className="text-[10px] text-muted-foreground">즉시 보너스 (+{tier.bonusPct}%)</span>
          <span className="tabular-nums font-display font-bold text-gold">+{formatKRW(bonus)}</span>
        </div>
        <div className="h-px bg-border/60 my-2" />
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] font-bold flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-gold" /> 회복 후 총 잔고
          </span>
          <span className="tabular-nums font-imperial font-black text-base text-gradient-gold">
            {formatKRW(total)}
          </span>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground mt-2 break-keep">
        과거 시뮬레이션 성과이며, 미래 수익을 보장하지 않습니다.
      </p>
    </div>
  );
}
