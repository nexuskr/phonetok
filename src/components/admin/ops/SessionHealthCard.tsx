// P0-8 — Session Health admin card (15s 자동 갱신)

import { useEffect, useState } from "react";
import {
  getSessionHealthSnapshot,
  type SessionHealthSnapshot,
} from "@/lib/auth/sessionHealth";

function fmtTs(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString("ko-KR", { hour12: false });
  } catch {
    return String(ts);
  }
}

export default function SessionHealthCard() {
  const [snap, setSnap] = useState<SessionHealthSnapshot>(() =>
    getSessionHealthSnapshot(),
  );

  useEffect(() => {
    const tick = () => setSnap(getSessionHealthSnapshot());
    tick();
    const id = window.setInterval(tick, 15_000);
    return () => window.clearInterval(id);
  }, []);

  const okCount = snap.refreshHistory.filter((r) => r.ok).length;
  const failCount = snap.refreshHistory.length - okCount;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="이 탭" value={snap.tabId} hint="TAB_ID" />
        <Kpi
          label="Peer 탭"
          value={String(snap.peers.length)}
          hint={snap.broadcastSupported ? "BroadcastChannel ON" : "Unsupported"}
        />
        <Kpi
          label="Refresh 성공 / 실패"
          value={`${okCount} / ${failCount}`}
          hint={`최근 ${snap.refreshHistory.length}회`}
        />
        <Kpi
          label="401 복구 (OK / Fail)"
          value={`${snap.recover401.success} / ${snap.recover401.failure}`}
          hint="recoverFrom401"
        />
      </div>

      <div className="glass-strong rounded-2xl p-4 border border-border/40">
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
          Last broadcast event
        </div>
        {snap.lastEvent ? (
          <div className="font-mono text-xs leading-relaxed">
            <div>
              <span className="text-muted-foreground">type:</span>{" "}
              <span className="font-bold">{snap.lastEvent.type}</span>
            </div>
            <div>
              <span className="text-muted-foreground">from tab:</span>{" "}
              {snap.lastEvent.tabId}
            </div>
            <div>
              <span className="text-muted-foreground">ts:</span>{" "}
              {fmtTs(snap.lastEvent.ts)}
            </div>
            {snap.lastEvent.meta && (
              <pre className="mt-2 text-[10px] text-muted-foreground overflow-x-auto">
                {JSON.stringify(snap.lastEvent.meta, null, 2)}
              </pre>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">이벤트 없음</div>
        )}
      </div>

      <div className="glass-strong rounded-2xl p-4 border border-border/40">
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
          Active peers
        </div>
        {snap.peers.length === 0 ? (
          <div className="text-sm text-muted-foreground">다른 탭 없음</div>
        ) : (
          <ul className="font-mono text-xs space-y-1">
            {snap.peers.map((p) => (
              <li key={p.tabId} className="flex justify-between gap-3">
                <span>{p.tabId}</span>
                <span className="text-muted-foreground">
                  last seen {fmtTs(p.lastSeen)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="glass-strong rounded-2xl p-4 border border-border/40">
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
          Refresh history (last 20)
        </div>
        {snap.refreshHistory.length === 0 ? (
          <div className="text-sm text-muted-foreground">기록 없음</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="text-left py-1">시각</th>
                  <th className="text-left py-1">결과</th>
                  <th className="text-right py-1">소요(ms)</th>
                  <th className="text-left py-1 pl-3">에러</th>
                </tr>
              </thead>
              <tbody>
                {snap.refreshHistory.map((r, i) => (
                  <tr key={i} className="border-t border-border/20">
                    <td className="py-1">{fmtTs(r.ts)}</td>
                    <td className="py-1">
                      {r.ok ? (
                        <span className="text-primary">OK</span>
                      ) : (
                        <span className="text-destructive">FAIL</span>
                      )}
                    </td>
                    <td className="py-1 text-right">{r.durationMs}</td>
                    <td className="py-1 pl-3 text-muted-foreground truncate max-w-[280px]">
                      {r.error ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="glass-strong rounded-2xl p-3 border border-border/40">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="font-display font-black text-lg mt-1 break-all">{value}</div>
      {hint && (
        <div className="text-[10px] text-muted-foreground mt-1">{hint}</div>
      )}
    </div>
  );
}
