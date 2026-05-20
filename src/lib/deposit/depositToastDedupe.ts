/**
 * P0-7 — Filled-toast dedupe across tabs + SW.
 *
 * Exactly one "입금 완료" toast per (intent id, 30s window) across all tabs
 * and SW push handlers. Coordinated via BroadcastChannel('phonara:dep:fill').
 *
 * Money-flow safe: pure client-side coordination, no RPC calls.
 */

const WINDOW_MS = 30_000;
const CHANNEL_NAME = "phonara:dep:fill";

const seen = new Map<string, number>();

let bc: BroadcastChannel | null = null;
function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (bc) return bc;
  try {
    bc = new BroadcastChannel(CHANNEL_NAME);
    bc.onmessage = (ev: MessageEvent<{ id: string; ts: number }>) => {
      const d = ev.data;
      if (!d?.id || !d?.ts) return;
      const prev = seen.get(d.id) ?? 0;
      if (d.ts > prev) seen.set(d.id, d.ts);
    };
  } catch {
    bc = null;
  }
  return bc;
}

function gc() {
  if (seen.size < 50) return;
  const cutoff = Date.now() - WINDOW_MS;
  for (const [k, v] of seen) if (v < cutoff) seen.delete(k);
}

/** True exactly once per `id` per 30s across all tabs + SW. */
export function claimFilledToast(id: string | null | undefined): boolean {
  if (!id) return true;
  const now = Date.now();
  const prev = seen.get(id) ?? 0;
  if (now - prev < WINDOW_MS) return false;
  seen.set(id, now);
  gc();
  try { getChannel()?.postMessage({ id, ts: now }); } catch { /* noop */ }
  return true;
}

export function _resetFilledToastDedupe() {
  seen.clear();
}

export function announceFilledFromSW(id: string) {
  claimFilledToast(id);
}
