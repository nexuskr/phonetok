/**
 * P0-7 — useDepositMonitoring
 *
 * PollingManager-backed monitoring for an in-flight deposit intent.
 * - priority: high, category: cosmetic (truth is the RPC, not this poll)
 * - adaptive interval (idle/bg multipliers) handled by PollingManager
 * - auto-unregister on terminal status
 *
 * Money-flow guardrail: caller must pass a read-only RPC wrapper.
 */
import { useEffect, useRef } from "react";
import { useGlobalPolling } from "@/hooks/polling/useGlobalPolling";

export type DepositIntentStatus =
  | "pending" | "intent_created" | "awaiting_payment"
  | "filled" | "expired" | "canceled" | "rejected";

export interface UseDepositMonitoringOpts {
  intentId: string | null;
  status: DepositIntentStatus | string | null;
  enabled?: boolean;
  poll: () => void | Promise<void>;
  baseMs?: number;
  owner?: string;
}

const TERMINAL = new Set(["filled", "expired", "canceled", "rejected"]);

export function useDepositMonitoring({
  intentId, status, enabled = true, poll, baseMs = 30_000, owner,
}: UseDepositMonitoringOpts) {
  const pollRef = useRef(poll);
  pollRef.current = poll;

  const isTerminal = !!status && TERMINAL.has(String(status));
  const active = enabled && !!intentId && !isTerminal;

  useGlobalPolling({
    key: active ? `deposit:monitor:${intentId}` : "deposit:monitor:idle",
    fn: () => pollRef.current(),
    baseMs,
    enabled: active,
    priority: "high",
    category: "cosmetic",
    leading: false,
    owner: owner ?? "useDepositMonitoring",
  });

  useEffect(() => {
    if (!isTerminal) return;
    // intentionally empty — caller settles UI from realtime/poll merge.
  }, [isTerminal]);
}
