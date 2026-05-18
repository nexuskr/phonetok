// IMPERIAL PHASE 4 — Circuit breaker state inspector (client-local).
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { inspect, reset } from "@/lib/imperialCircuitV2";

const WATCH_KEYS = [
  "imperial_get_flywheel_health",
  "imperial_get_auto_heal_log",
  "imperial_get_observability_stream",
  "get_flywheel_snapshot",
  "admin_get_kernel_summary",
];

export default function ImperialCircuitPanel() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <Card className="p-4">
      <div className="text-xs font-bold mb-3">⚡ Circuit Breaker v2 (client)</div>
      <div className="space-y-1 text-xs font-mono">
        {WATCH_KEYS.map((k) => {
          const s = inspect(k);
          const tone = s.state === "open" ? "text-rose-300" : s.state === "half_open" ? "text-amber-300" : "text-emerald-300";
          return (
            <div key={k} className="flex items-center justify-between border-b border-border/30 py-1">
              <span>{k}</span>
              <span className="flex items-center gap-2">
                <span className={tone}>{s.state}</span>
                <span className="text-muted-foreground">fail={s.failures}</span>
                {s.state !== "closed" && (
                  <Button size="sm" variant="outline" onClick={() => { reset(k); setTick((t) => t + 1); }}>reset</Button>
                )}
              </span>
            </div>
          );
        })}
      </div>
      <div className="text-[10px] text-muted-foreground mt-2">tick #{tick}</div>
    </Card>
  );
}
