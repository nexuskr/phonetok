/**
 * Phase 4 Sprint 3 — Haptic Feedback Hook
 * ----------------------------------------
 * navigator.vibrate 래퍼. iOS Safari 미지원이지만 silent no-op 으로 안전.
 * - 절대 throw 하지 않음
 * - prefers-reduced-motion 시 자동 비활성
 * - localStorage `phonara:haptic:v1` = "0" 로 강제 OFF 가능
 */

export type HapticKind =
  | "light"
  | "medium"
  | "heavy"
  | "success"
  | "warning"
  | "error"
  | "impact";

const PATTERNS: Record<HapticKind, number | number[]> = {
  light: 8,
  medium: 18,
  heavy: 35,
  success: [10, 40, 10],
  warning: [20, 60, 20],
  error: [40, 30, 40, 30, 40],
  impact: 25,
};

const FLAG = "phonara:haptic:v1";

function enabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem(FLAG) === "0") return false;
  } catch {
    /* noop */
  }
  try {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  } catch {
    /* noop */
  }
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

export function triggerHaptic(kind: HapticKind = "light"): boolean {
  if (!enabled()) return false;
  try {
    return navigator.vibrate(PATTERNS[kind] ?? 10);
  } catch {
    return false;
  }
}

export function disableHaptic(persist = true) {
  if (!persist) return;
  try {
    localStorage.setItem(FLAG, "0");
  } catch {
    /* noop */
  }
}

/** React hook — stable identity, 호출자는 그냥 `haptic("success")`. */
export function useHaptic() {
  return triggerHaptic;
}
