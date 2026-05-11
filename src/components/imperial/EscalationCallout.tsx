import { Link } from "react-router-dom";
import { Crown, ArrowRight } from "lucide-react";
import { useImperialState } from "@/hooks/use-imperial-state";

function formatKRW(n: number) {
  if (n >= 100_000_000) return `₩${(n / 100_000_000).toFixed(n % 100_000_000 === 0 ? 0 : 1)}억`;
  if (n >= 10_000_000)  return `₩${(n / 10_000).toFixed(0)}만`;
  if (n >= 10_000)      return `₩${(n / 10_000).toFixed(0)}만`;
  return `₩${n.toLocaleString()}`;
}

export default function EscalationCallout({ className = "" }: { className?: string }) {
  const { state } = useImperialState();
  const m = state.next_milestone;
  if (!m) return null;
  const perks = m.reward_json?.perks ?? [];
  return (
    <Link
      to="/packages"
      className={
        "block rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 hover:border-primary/70 transition " +
        className
      }
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.2em] text-primary uppercase">
            <Crown className="w-3 h-3" /> 다음 사다리
          </div>
          <div className="font-imperial font-black text-lg mt-1 truncate">{m.label}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            <span className="font-bold text-foreground tabular-nums">{formatKRW(m.remaining_krw)}</span> 더 입금 →
            {perks.slice(0, 2).map((p, i) => (
              <span key={i} className="ml-1.5 inline-block px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold">
                {p}
              </span>
            ))}
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-primary shrink-0 group-hover:translate-x-0.5 transition" />
      </div>
    </Link>
  );
}
