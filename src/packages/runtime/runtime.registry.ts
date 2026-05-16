/**
 * @pkg/runtime/runtime.registry — Dual Ledger (Phase 2 Visibility Contract)
 *
 *  tracked   = intentional execution (setVisibleInterval / explicit trackInterval)
 *  untracked = system entropy (legacy setInterval, captured by runtime.observe)
 *
 *  coverage  = tracked / (tracked + untracked)   — visibility metric, NOT optimization.
 *
 *  Rules (absolute):
 *   - No interval is neutral. It belongs to exactly one ledger.
 *   - Untracked is never assumed safe — only visible.
 *   - This module changes no behavior. It only classifies.
 */

export type RuntimeCategory =
  | "money_flow"   // wallet / trading / oracle / kill-switch
  | "cosmetic"     // ticker / marquee / countdown
  | "admin"        // operator panels
  | "unknown";     // classification failed → entropy

export type LedgerEntry = {
  owner: string;
  intervalMs: number;
  category: RuntimeCategory;
  createdAt: number;
  stack?: string;
};

const IS_DEV = (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;

const tracked   = new Map<number, LedgerEntry>();
const untracked = new Map<number, LedgerEntry>();

const subs = new Set<() => void>();
let notifyScheduled = false;
function scheduleNotify() {
  if (notifyScheduled) return;
  notifyScheduled = true;
  const flush = () => {
    notifyScheduled = false;
    subs.forEach((fn) => { try { fn(); } catch { /* noop */ } });
  };
  if (typeof queueMicrotask === "function") queueMicrotask(flush);
  else setTimeout(flush, 0);
}

/** Register an interval as INTENTIONAL. Safe to call in prod; no-op outside DEV. */
export function trackInterval(id: number, meta: LedgerEntry): void {
  if (!IS_DEV || typeof id !== "number") return;
  untracked.delete(id);
  tracked.set(id, meta);
  scheduleNotify();
}

/** Register an interval as ENTROPY (legacy). Called by runtime.observe override. */
export function markUntracked(id: number, meta: LedgerEntry): void {
  if (!IS_DEV || typeof id !== "number") return;
  if (tracked.has(id)) return; // intentional always wins
  untracked.set(id, meta);
  if (meta.category === "unknown") {
    // 1회 경고 — entropy 가시화 신호
    try { console.warn("[entropy] uncategorized interval", meta); } catch { /* noop */ }
  }
  scheduleNotify();
}

/** Remove from both ledgers (called by clearInterval wrapper). */
export function forgetInterval(id: number): void {
  if (!IS_DEV || typeof id !== "number") return;
  const a = tracked.delete(id);
  const b = untracked.delete(id);
  if (a || b) scheduleNotify();
}

export function snapshot(): { tracked: LedgerEntry[]; untracked: LedgerEntry[] } {
  return {
    tracked: Array.from(tracked.values()),
    untracked: Array.from(untracked.values()),
  };
}

export function counts(): { tracked: number; untracked: number; total: number; coverage: number } {
  const t = tracked.size;
  const u = untracked.size;
  const total = t + u;
  return { tracked: t, untracked: u, total, coverage: total === 0 ? 0 : t / total };
}

export function byCategory(): Record<RuntimeCategory, { tracked: number; untracked: number }> {
  const out: Record<RuntimeCategory, { tracked: number; untracked: number }> = {
    money_flow: { tracked: 0, untracked: 0 },
    cosmetic:   { tracked: 0, untracked: 0 },
    admin:      { tracked: 0, untracked: 0 },
    unknown:    { tracked: 0, untracked: 0 },
  };
  for (const e of tracked.values())   out[e.category].tracked   += 1;
  for (const e of untracked.values()) out[e.category].untracked += 1;
  return out;
}

export function subscribe(fn: () => void): () => void {
  subs.add(fn);
  return () => subs.delete(fn);
}

/** Phase 4 SYSTEM_DEGRADE will use this. Stub-callable in Phase 2 (no-op kill). */
export function listIdsByCategory(cat: RuntimeCategory): number[] {
  const ids: number[] = [];
  for (const [id, e] of tracked.entries())   if (e.category === cat) ids.push(id);
  for (const [id, e] of untracked.entries()) if (e.category === cat) ids.push(id);
  return ids;
}

/** Dev-only debug accessor — never call in prod. */
export function __DEV_internals() {
  return IS_DEV ? { tracked, untracked } : null;
}
