import { g } from "@pkg/core/i18n/glossary";
import { useWalletSnapshot } from "../hooks/useWalletSnapshot";
import { formatFromPhon } from "@/lib/displayCurrency";
import ProcessingBanner from "./ProcessingBanner";

function KpiCell({ label, phon }: { label: string; phon: number }) {
  return (
    <div className="rounded-xl glass-strong border border-border/40 px-3 py-3 text-center">
      <div className="text-[10px] tracking-widest font-bold text-muted-foreground uppercase">{label}</div>
      <div className="mt-1.5 font-black text-base sm:text-lg tabular-nums text-foreground">
        {Math.floor(phon).toLocaleString()}
      </div>
      <div className="text-[10px] text-muted-foreground tabular-nums">
        {g("walletKrwApprox")} {formatFromPhon(phon, "KRW")}
      </div>
    </div>
  );
}

export default function WalletDashboard() {
  const { loading, available, todayEarn, weekEarn } = useWalletSnapshot();

  return (
    <section
      className="rounded-3xl border border-amber-400/30 bg-gradient-to-br from-amber-500/10 via-background to-background px-4 sm:px-6 py-6 shadow-[0_0_48px_hsl(45_100%_55%/0.15)] space-y-5"
      aria-label={g("walletHeader")}
    >
      <div className="text-center">
        <div className="text-[11px] tracking-[0.3em] font-bold text-amber-300/80 uppercase">
          {g("walletBalance")}
        </div>
        <div
          className="mt-2 font-black tabular-nums text-amber-300 leading-none text-6xl md:text-7xl drop-shadow-[0_0_24px_hsl(45_100%_55%/0.4)]"
          aria-busy={loading}
        >
          {Math.floor(available).toLocaleString()}
        </div>
        <div className="mt-2 text-base text-muted-foreground tabular-nums">
          {g("walletKrwApprox")} <span className="font-bold text-foreground/80">{formatFromPhon(available, "KRW")}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <KpiCell label={g("walletTodayEarn")} phon={todayEarn} />
        <KpiCell label={g("walletWeekEarn")} phon={weekEarn} />
        <KpiCell label={g("walletAvailable")} phon={available} />
      </div>

      <ProcessingBanner />
    </section>
  );
}
