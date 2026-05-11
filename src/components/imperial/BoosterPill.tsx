import { Flame } from "lucide-react";
import { useImperialState, useBoosterCountdown } from "@/hooks/use-imperial-state";

type Props = {
  /** Multiplier label, e.g. "×2" or "×1.5" */
  multiplier?: string;
  className?: string;
};

export default function BoosterPill({ multiplier = "×2", className = "" }: Props) {
  const { state } = useImperialState();
  const remaining = useBoosterCountdown(state.booster_expires_at);
  if (!state.booster_active || !remaining) return null;
  return (
    <span
      className={
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 border border-primary/40 text-[10px] font-bold text-primary tabular-nums " +
        className
      }
      aria-label={`Booster ${multiplier} active`}
    >
      <Flame className="w-3 h-3" />
      <span>{multiplier}</span>
      <span className="opacity-70">{remaining}</span>
    </span>
  );
}
