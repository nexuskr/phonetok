/**
 * PhonSpendPanel — /wallet 상단 PHON 사용처 카드 3종
 * 1) Fee Discount (1~1000 PHON, 50% 수수료 할인 슬롯)
 * 2) Booster 24h (5,000 PHON, 수수료 -30% / Crown ×1.5 / 레버리지 7x)
 * 3) Crown Boost 24h (1,000 PHON, Crown ×1.5)
 */
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Coins, Zap, Crown, Sparkles, Loader2 } from "lucide-react";
import { useMyPower } from "@/hooks/use-my-power";
import { spendPhonForFeeDiscount, spendPhonForBooster, spendPhonForCrownBoost, PHON_COSTS } from "@/lib/phonSpend";
import { notify } from "@/lib/notify";
import { Link } from "react-router-dom";

export default function PhonSpendPanel() {
  const { phon } = useMyPower();
  const [feeAmt, setFeeAmt] = useState("100");
  const [busy, setBusy] = useState<null | "fee" | "boost" | "crown">(null);

  const feeNum = Math.max(0, Math.floor(Number(feeAmt) || 0));
  const feeValid = feeNum >= PHON_COSTS.feeDiscountMin && feeNum <= PHON_COSTS.feeDiscountMax && feeNum <= phon;

  async function doFee() {
    if (!feeValid) return;
    setBusy("fee");
    try {
      const r = await spendPhonForFeeDiscount(feeNum);
      notify.success(`수수료 50% 할인 슬롯 활성 · ${r.spent} PHON 사용`);
    } catch (e: any) {
      notify.error(e.message ?? "사용 실패");
    } finally { setBusy(null); }
  }
  async function doBoost() {
    if (phon < PHON_COSTS.booster) return;
    setBusy("boost");
    try {
      await spendPhonForBooster();
      notify.success("24h Empire Booster 활성 — 수수료 -30% · Crown ×1.5 · 레버리지 7x");
    } catch (e: any) {
      notify.error(e.message ?? "사용 실패");
    } finally { setBusy(null); }
  }
  async function doCrown() {
    if (phon < PHON_COSTS.crownBoost) return;
    setBusy("crown");
    try {
      await spendPhonForCrownBoost();
      notify.success("24h Crown ×1.5 부스트 활성");
    } catch (e: any) {
      notify.error(e.message ?? "사용 실패");
    } finally { setBusy(null); }
  }

  return (
    <Card className="relative overflow-hidden p-5 mb-5 border border-primary/30 bg-gradient-to-br from-background via-background to-primary/[0.04]">
      <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="font-imperial text-sm tracking-[0.18em] text-gradient-imperial">PHON · 권력의 혈액</h3>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground tracking-wider">보유</div>
            <div className="font-mono font-black text-lg tabular-nums text-primary">{phon.toLocaleString()} <span className="text-xs">PHON</span></div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* 1. Fee Discount */}
          <div className="glass rounded-xl p-4 border border-border/40 hover:border-primary/40 transition group">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="w-4 h-4 text-primary group-hover:scale-110 transition" />
              <span className="text-xs font-black">수수료 50% 할인</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed mb-3">
              1~1,000 PHON 사용 시 다음 출금 1회 수수료 50% 할인 슬롯 적립
            </p>
            <div className="flex gap-2 mb-2">
              <Input
                type="number"
                value={feeAmt}
                onChange={e => setFeeAmt(e.target.value)}
                min={1}
                max={1000}
                className="h-9 text-xs font-mono tabular-nums"
                placeholder="100"
              />
              <Button
                size="sm"
                disabled={!feeValid || busy === "fee"}
                onClick={doFee}
                className="h-9 px-3 text-[11px] font-bold"
              >
                {busy === "fee" ? <Loader2 className="w-3 h-3 animate-spin" /> : "사용"}
              </Button>
            </div>
            <div className="text-[10px] text-muted-foreground">
              예상 절감: <span className="text-primary font-bold">−{(feeNum * 50).toLocaleString()}원</span>
            </div>
          </div>

          {/* 2. Booster */}
          <div className="glass rounded-xl p-4 border border-gold/30 hover:border-gold/60 transition group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-gold/5 to-transparent pointer-events-none" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-gold group-hover:scale-110 transition" />
                <span className="text-xs font-black">Empire Booster 24h</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed mb-3">
                수수료 −30% · Crown ×1.5 · 레버리지 7x
              </p>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-muted-foreground">비용</span>
                <span className="font-mono font-bold text-sm text-gold tabular-nums">{PHON_COSTS.booster.toLocaleString()} PHON</span>
              </div>
              <Button
                size="sm"
                disabled={phon < PHON_COSTS.booster || busy === "boost"}
                onClick={doBoost}
                className="w-full h-9 text-[11px] font-bold bg-gradient-to-r from-gold to-gold/70 text-gold-foreground hover:opacity-90"
              >
                {busy === "boost" ? <Loader2 className="w-3 h-3 animate-spin" /> : phon < PHON_COSTS.booster ? "PHON 부족" : "24h 활성화"}
              </Button>
            </div>
          </div>

          {/* 3. Crown Boost */}
          <div className="glass rounded-xl p-4 border border-border/40 hover:border-primary/40 transition group">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-4 h-4 text-primary group-hover:scale-110 transition" />
              <span className="text-xs font-black">Crown ×1.5 24h</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed mb-3">
              모든 Crown 적립 1.5배 · 24시간 지속
            </p>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-muted-foreground">비용</span>
              <span className="font-mono font-bold text-sm text-primary tabular-nums">{PHON_COSTS.crownBoost.toLocaleString()} PHON</span>
            </div>
            <Button
              size="sm"
              disabled={phon < PHON_COSTS.crownBoost || busy === "crown"}
              onClick={doCrown}
              className="w-full h-9 text-[11px] font-bold"
              variant="outline"
            >
              {busy === "crown" ? <Loader2 className="w-3 h-3 animate-spin" /> : phon < PHON_COSTS.crownBoost ? "PHON 부족" : "24h 활성화"}
            </Button>
          </div>
        </div>

        {phon < PHON_COSTS.crownBoost && (
          <div className="mt-3 text-center">
            <Link to="/packages" className="text-[11px] text-primary underline-offset-2 hover:underline">
              PHON 부족? 패키지로 더 많이 적립 →
            </Link>
          </div>
        )}
      </div>
    </Card>
  );
}
