import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function ScarcityBar({
  used,
  total,
  label,
}: {
  used: number;
  total: number;
  label?: string;
}) {
  const { t } = useTranslation("convert");
  const labelText = label ?? t("seatsToday");
  const [liveUsed, setLiveUsed] = useState(used);
  useEffect(() => {
    let alive = true;
    function schedule() {
      if (!alive) return;
      const delay = 28_000 + Math.random() * 50_000;
      window.setTimeout(() => {
        if (!alive) return;
        setLiveUsed((u) => Math.min(total - 1, u + 1));
        schedule();
      }, delay);
    }
    schedule();
    return () => { alive = false; };
  }, [total]);

  const pct = Math.min(100, (liveUsed / total) * 100);
  const danger = pct >= 80;

  return (
    <div className="glass rounded-xl p-3">
      <div className="flex items-center justify-between text-[10px] mb-1.5">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Users className="w-3 h-3" /> {labelText}
        </span>
        <span
          key={liveUsed}
          className={`font-bold tabular-nums animate-fade-up ${danger ? "text-destructive animate-pulse" : "text-gold"}`}
        >
          {liveUsed} / {total}
        </span>
      </div>
      <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
        <div
          className={`h-full transition-[width] duration-700 ${
            danger ? "bg-gradient-to-r from-destructive to-gold" : "bg-gradient-gold"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
