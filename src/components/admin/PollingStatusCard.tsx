// PR-P0-2 — Polling Status card (admin / Health Dock)
//
// 운영자에게 활성 polling 현황을 보여준다.
// 15s 자동 갱신 (자기 자신은 PollingManager 미사용 — observation).

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PollingManager } from "@/lib/polling/PollingManager";
import { rateGuardSnapshot } from "@/lib/api/rateGuard";

export function PollingStatusCard() {
  const [snap, setSnap] = useState(() => PollingManager.snapshot());
  const [rg, setRg] = useState(() => rateGuardSnapshot());

  useEffect(() => {
    const id = window.setInterval(() => {
      setSnap(PollingManager.snapshot());
      setRg(rateGuardSnapshot());
    }, 5_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-sm">
          <span>Polling Status</span>
          <span className="flex gap-2">
            <Badge variant="outline">{snap.activeCount} active</Badge>
            <Badge variant="outline">{snap.callsPerMin}/min</Badge>
            <Badge variant="outline">{snap.savedRequests} saved</Badge>
            <Badge variant="outline">in-flight {snap.inFlight}</Badge>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="text-left p-1">key</th>
                <th className="text-left p-1">priority</th>
                <th className="text-left p-1">cat</th>
                <th className="text-right p-1">base</th>
                <th className="text-right p-1">current</th>
                <th className="text-right p-1">×back</th>
                <th className="text-right p-1">ref</th>
                <th className="text-right p-1">runs</th>
                <th className="text-right p-1">err</th>
              </tr>
            </thead>
            <tbody>
              {snap.pollers.map((p) => (
                <tr key={p.key} className="border-t border-border/30">
                  <td className="p-1 font-mono">{p.key}</td>
                  <td className="p-1">{p.priority}</td>
                  <td className="p-1">{p.category}</td>
                  <td className="p-1 text-right">{p.baseMs}</td>
                  <td className="p-1 text-right">{p.currentMs}</td>
                  <td className="p-1 text-right">{p.backoffMul}</td>
                  <td className="p-1 text-right">{p.refCount}</td>
                  <td className="p-1 text-right">{p.totalRuns}</td>
                  <td className="p-1 text-right">{p.totalErrors}</td>
                </tr>
              ))}
              {snap.pollers.length === 0 && (
                <tr><td colSpan={9} className="p-2 text-muted-foreground text-center">no active pollers</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {rg.length > 0 && (
          <div className="border-t border-border/30 pt-2">
            <div className="text-xs text-muted-foreground mb-1">Rate Guard (recent/window)</div>
            <div className="flex flex-wrap gap-1">
              {rg.map((r) => (
                <Badge key={r.endpoint} variant={r.backoffMs > 0 ? "destructive" : "outline"} className="text-[10px]">
                  {r.endpoint}: {r.recent}{r.backoffMs > 0 ? ` (backoff ${Math.round(r.backoffMs/1000)}s)` : ""}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
