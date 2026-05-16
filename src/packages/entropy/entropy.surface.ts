/**
 * @pkg/entropy/entropy.surface — current observed runtime footprint.
 *
 * Pure read layer over @pkg/runtime. Emits snapshots; never mutates.
 */
import { snapshot, counts, byCategory } from "@pkg/runtime";

export function surfaceSnapshot() {
  return {
    capturedAt: new Date().toISOString(),
    counts: counts(),
    byCategory: byCategory(),
    entries: snapshot(),
  };
}

/** JSON-safe surface (drops stack traces for size). */
export function surfaceReport() {
  const s = surfaceSnapshot();
  return {
    capturedAt: s.capturedAt,
    counts: s.counts,
    byCategory: s.byCategory,
    tracked: s.entries.tracked.map(({ stack, ...rest }) => rest),
    untracked: s.entries.untracked.map(({ stack, ...rest }) => rest),
  };
}
