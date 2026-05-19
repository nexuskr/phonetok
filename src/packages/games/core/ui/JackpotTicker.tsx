import { useEffect, useState } from "react";
import { useGameChannel } from "@pkg/realtime";
import { cn } from "@/lib/utils";

export interface JackpotTickerProps {
  /** Realtime resource path within `game:` partition, e.g. "jackpot:crash". */
  resource: string;
  /** Initial value before first realtime push. */
  initial?: number;
  label?: string;
  className?: string;
}

/**
 * P1-08 JackpotTicker — server-pushed counter via useGameChannel.
 * No raw supabase.channel anywhere.
 */
export function JackpotTicker({
  resource,
  initial = 0,
  label = "JACKPOT",
  className,
}: JackpotTickerProps) {
  const [v, setV] = useState(initial);
  const [pulse, setPulse] = useState(false);

  useGameChannel({
    key: resource,
    handlers: {
      broadcast: [
        {
          event: "tick",
          callback: (payload: any) => {
            const next = Number(payload?.value ?? 0);
            if (!Number.isFinite(next)) return;
            setV(next);
            setPulse(true);
            window.setTimeout(() => setPulse(false), 600);
          },
        },
      ],
    },
  });

  useEffect(() => setV(initial), [initial]);

  return (
    <div
      className={cn(
        "imperial-card relative inline-flex items-center gap-2 rounded-full",
        "border border-primary/40 px-3 py-1.5",
        pulse && "pulse-halo",
        className,
      )}
    >
      <span className="text-[10px] font-bold tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className="text-gradient-gold font-mono text-sm font-extrabold tabular-nums">
        {v.toLocaleString("ko-KR")}
      </span>
    </div>
  );
}
