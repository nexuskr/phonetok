import { Loader2 } from "lucide-react";
import { g } from "@pkg/core/i18n/glossary";
import { useWithdrawQueue } from "@/lib/withdrawal/useWithdrawQueue";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { formatFromPhon } from "@/lib/displayCurrency";

export default function ProcessingBanner() {
  const user = useRequireAuth();
  const { withdrawals } = useWithdrawQueue();
  const mine = withdrawals.filter(w => w.user_id === user?.id);
  if (mine.length === 0) return null;
  const top = mine[0];

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-2xl border-2 border-amber-300/50 bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-amber-500/15 px-4 py-4 flex items-center gap-3 shadow-[0_0_24px_hsl(45_100%_55%/0.25)]"
    >
      <Loader2 className="w-6 h-6 text-amber-300 animate-spin shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-black text-base text-amber-200">
          {g("processingBannerTitle")} · {mine.length}건
        </div>
        <div className="text-xs text-amber-100/80 mt-0.5 truncate">
          {g("processingBannerSub")} · {formatFromPhon(Number(top.amount), "KRW")}
        </div>
      </div>
    </div>
  );
}
