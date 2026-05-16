/**
 * @pkg/runtime/runtime.governor — Phase 4 SYSTEM_DEGRADE entry point (STUB).
 *
 * This module is intentionally inert in Phase 2.
 * It declares the API surface so callers can be wired in advance,
 * but no kill/throttle action is taken yet.
 *
 * Phase 4 will implement killCategory/killAll backed by listIdsByCategory.
 */
import { listIdsByCategory, type RuntimeCategory } from "./runtime.registry";

/** Phase 2: stub. Returns ids that WOULD be killed; does not kill. */
export function previewKillCategory(cat: RuntimeCategory): number[] {
  return listIdsByCategory(cat);
}

/** Phase 4 will implement. */
export function killCategory(_cat: RuntimeCategory): void {
  if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
    console.warn("[runtime.governor] killCategory is a Phase 4 stub — no action taken");
  }
}

export function killAll(): void {
  if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
    console.warn("[runtime.governor] killAll is a Phase 4 stub — no action taken");
  }
}
