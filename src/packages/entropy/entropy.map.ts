/**
 * @pkg/entropy/entropy.map — re-export classification helpers for convenience.
 *
 * The actual logic lives in @pkg/runtime/runtime.lattice (single source of truth).
 */
export { inferCategoryFromStack, inferOwnerFromStack } from "@pkg/runtime";
