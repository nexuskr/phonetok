/**
 * @pkg/entropy/entropy.capture — boot entry that activates runtime observation.
 *
 * Import this once from App.tsx (idle-deferred). DEV only.
 * Production builds dead-code the body via import.meta.env.DEV guard.
 */
const IS_DEV = (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;

export function captureEntropy(): void {
  if (!IS_DEV) return;
  // Importing the observer installs the window.setInterval override as a side effect.
  void import("@pkg/runtime/runtime.observe").catch(() => { /* noop */ });
}
