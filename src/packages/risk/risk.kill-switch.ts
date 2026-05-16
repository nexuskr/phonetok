/**
 * @pkg/risk/risk.kill-switch — Phase 4 stub.
 *
 * Delegates to @pkg/runtime governor when implemented.
 */
import { killCategory } from "@pkg/runtime";
import type { RuntimeCategory } from "@pkg/runtime";

export function killByCategory(cat: RuntimeCategory): void {
  killCategory(cat); // governor warns; Phase 2 = no-op
}
