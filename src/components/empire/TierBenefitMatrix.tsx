import { memo } from "react";
import { Check, Minus } from "lucide-react";

export type MatrixTier = {
  key: string;
  name: string;
  emblem: string;
  rarityKo: string;
  step: number; // 1..7
  recoveryBonus: number;
  territoryBonus: number;
  vipRoulette: boolean;
  priorityWithdraw: boolean;
};

type Props = { tiers: MatrixTier[] };

function YesNo({ ok }: { ok: boolean }) {
  return ok ? (
    <Check className="w-4 h-4 text-gold inline-block" aria-label="포함" />
  ) : (
    <Minus className="w-4 h-4 text-muted-foreground inline-block" aria-label="없음" />
  );
}

function TierBenefitMatrixInner({ tiers }: Props) {
  return (
    <div className="w-full">
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-widest text-muted-foreground border-b border-border/40">
              <th className="py-2 pr-3">단계 · 카드</th>
              <th className="py-2 px-3">손실 자동 보상</th>
              <th className="py-2 px-3">보상 가속</th>
              <th className="py-2 px-3">VIP 골드 룰렛</th>
              <th className="py-2 px-3">출금 우선 처리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {tiers.map((t) => (
              <tr key={t.key}>
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl" aria-hidden>{t.emblem}</span>
                    <div className="min-w-0">
                      <div className="font-imperial font-black text-sm leading-tight">{t.name}</div>
                      <div className="text-[10px] text-muted-foreground">{t.step}단계 · {t.rarityKo}</div>
                    </div>
                  </div>
                </td>
                <td className="py-2.5 px-3 font-black text-gold tabular-nums">{t.recoveryBonus}%</td>
                <td className="py-2.5 px-3 font-black text-secondary tabular-nums">+{t.territoryBonus}%</td>
                <td className="py-2.5 px-3"><YesNo ok={t.vipRoulette} /></td>
                <td className="py-2.5 px-3"><YesNo ok={t.priorityWithdraw} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards */}
      <ul className="md:hidden space-y-2">
        {tiers.map((t) => (
          <li key={t.key} className="glass rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl" aria-hidden>{t.emblem}</span>
              <div className="flex-1 min-w-0">
                <div className="font-imperial font-black text-sm">{t.name}</div>
                <div className="text-[10px] text-muted-foreground">{t.step}단계 · {t.rarityKo}</div>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              <dt className="text-muted-foreground">손실 자동 보상</dt>
              <dd className="font-black text-gold tabular-nums">{t.recoveryBonus}%</dd>
              <dt className="text-muted-foreground">보상 가속</dt>
              <dd className="font-black text-secondary tabular-nums">+{t.territoryBonus}%</dd>
              <dt className="text-muted-foreground">VIP 골드 룰렛</dt>
              <dd><YesNo ok={t.vipRoulette} /></dd>
              <dt className="text-muted-foreground">출금 우선 처리</dt>
              <dd><YesNo ok={t.priorityWithdraw} /></dd>
            </dl>
          </li>
        ))}
      </ul>

      <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
        ※ 카드는 별도 비용 없이 입금·미션·전투 진행에 따라 자동 강화되는 "혜택 등급"입니다.
      </p>
    </div>
  );
}

export default memo(TierBenefitMatrixInner);
