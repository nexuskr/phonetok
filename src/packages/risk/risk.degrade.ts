/**
 * @pkg/risk/risk.degrade — cosmetic kill catalog (STUB).
 *
 * Phase 4 will enumerate which categories/owners are sacrificial under
 * SYSTEM_DEGRADE. In Phase 2 this is a declarative manifest only.
 */
import type { RuntimeCategory } from "@pkg/runtime";

export const SACRIFICIAL_CATEGORIES: RuntimeCategory[] = ["cosmetic"];

export function isSacrificial(category: RuntimeCategory): boolean {
  return SACRIFICIAL_CATEGORIES.includes(category);
}
