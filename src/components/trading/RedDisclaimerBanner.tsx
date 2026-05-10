import { AlertTriangle } from "lucide-react";

/**
 * Always-visible high-risk disclaimer banner, sticky at top.
 * Use on every trading screen; pair with `pt-[88px]` content offset.
 */
export default function RedDisclaimerBanner() {
  return (
    <div
      role="alert"
      className="relative z-30 bg-gradient-to-r from-red-700 via-red-600 to-red-700 text-white text-center py-2 px-3 text-[11px] sm:text-sm font-semibold shadow-[0_4px_20px_rgba(220,38,38,0.4)] border-b-4 border-red-900"
    >
      <div className="flex items-center justify-center gap-2 mb-0.5">
        <AlertTriangle className="w-4 h-4 animate-pulse" />
        <span className="tracking-wider font-black">HIGH RISK TRADING — YOU MAY LOSE ALL YOUR FUNDS</span>
        <AlertTriangle className="w-4 h-4 animate-pulse" />
      </div>
      <p className="opacity-90 text-[10px] sm:text-xs leading-snug">
        고위험 거래입니다. 투자 원금 전액 손실 가능성이 있습니다. 모든 거래는 이용자 본인 책임이며,
        본 플랫폼은 어떠한 손실도 보상하지 않습니다. This is high-risk trading. You can lose all your money.
        Trade at your own risk. This is not financial advice.
      </p>
    </div>
  );
}
