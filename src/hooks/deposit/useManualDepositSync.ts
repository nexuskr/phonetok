/**
 * P0-7 — useManualDepositSync
 *
 * Multi-tab safe status sync for manual deposits (bank/voucher) resolved by
 * an admin and updated on `deposit_requests`.
 *
 * - BroadcastChannel('phonara:dep:manual:{id}') leader election:
 *   each tab heartbeats `{rank: Math.random(), ts}` every 2s; lowest rank wins.
 *   Leader = no lower-rank peer heard in 5s. Leader binds realtime.
 * - Resolved toast deduped via `claimFilledToast`.
 *
 * Money-flow safe: realtime SELECT only — no writes.
 */
import { useEffect, useRef, useState } from "react";
import { useWalletChannel } from "@pkg/realtime";
import { claimFilledToast } from "@/lib/deposit/depositToastDedupe";

export type ManualDepositStatus =
  | "pending" | "approved" | "rejected" | "filled" | "completed" | "canceled";

export interface ManualDepositRow {
  id: string;
  status: ManualDepositStatus | string;
  amount?: number | null;
  resolved_at?: string | null;
  rejection_reason?: string | null;
}

export interface UseManualDepositSyncOpts {
  requestId: string | null;
  enabled?: boolean;
  onResolved?: (row: ManualDepositRow) => void;
  onUpdate?: (row: ManualDepositRow) => void;
}

const HEARTBEAT_MS = 2_000;
const LEADER_TIMEOUT_MS = 5_000;
const TERMINAL = ["approved", "rejected", "filled", "completed", "canceled"];

export function useManualDepositSync({
  requestId, enabled = true, onResolved, onUpdate,
}: UseManualDepositSyncOpts) {
  const [isLeader, setIsLeader] = useState(false);
  const myRankRef = useRef<number>(Math.random());
  const lastPeerAtRef = useRef<number>(0);
  const lastPeerRankRef = useRef<number>(Number.POSITIVE_INFINITY);

  useEffect(() => {
    if (!enabled || !requestId) { setIsLeader(false); return; }
    if (typeof BroadcastChannel === "undefined") {
      setIsLeader(true);
      return;
    }
    let bc: BroadcastChannel | null = null;
    try { bc = new BroadcastChannel(`phonara:dep:manual:${requestId}`); }
    catch { setIsLeader(true); return; }

    myRankRef.current = Math.random();
    lastPeerAtRef.current = 0;
    lastPeerRankRef.current = Number.POSITIVE_INFINITY;

    bc.onmessage = (ev: MessageEvent<{ rank: number; ts: number }>) => {
      const d = ev.data;
      if (!d) return;
      lastPeerAtRef.current = Date.now();
      if (d.rank < lastPeerRankRef.current) lastPeerRankRef.current = d.rank;
      if (d.rank < myRankRef.current) setIsLeader(false);
    };

    setIsLeader(true);
    const tick = window.setInterval(() => {
      const now = Date.now();
      try { bc?.postMessage({ rank: myRankRef.current, ts: now }); } catch { /* noop */ }
      const peerStale = now - lastPeerAtRef.current > LEADER_TIMEOUT_MS;
      const noLowerPeer = lastPeerRankRef.current >= myRankRef.current;
      setIsLeader(peerStale || noLowerPeer);
    }, HEARTBEAT_MS);

    return () => {
      clearInterval(tick);
      try { bc?.close(); } catch { /* noop */ }
    };
  }, [enabled, requestId]);

  const resolvedRef = useRef<Set<string>>(new Set());
  useWalletChannel({
    key: enabled && isLeader && requestId ? `deposit:manual:${requestId}` : "",
    bindings: requestId
      ? [{ event: "UPDATE", schema: "public", table: "deposit_requests", filter: `id=eq.${requestId}` }]
      : [],
    enabled: enabled && isLeader && !!requestId,
    onEvent: (payload) => {
      const row = (payload as unknown as { new: ManualDepositRow }).new;
      if (!row?.id) return;
      onUpdate?.(row);
      if (TERMINAL.includes(String(row.status))) {
        if (resolvedRef.current.has(row.id)) return;
        resolvedRef.current.add(row.id);
        if (claimFilledToast(`manual:${row.id}:${row.status}`)) {
          onResolved?.(row);
        }
      }
    },
  });

  return { isLeader };
}
