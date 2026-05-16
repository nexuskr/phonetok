/**
 * @pkg/runtime/runtime.observe — DEV-only window.setInterval / clearInterval override
 *
 *  Zero-intrusion instrumentation contract:
 *   - native is called first; we only register the returned id.
 *   - No timing change, no arg mutation, no throttle, no block.
 *   - In production this module is a no-op (entire body guarded by import.meta.env.DEV).
 *
 *  Boot: side-effect import once, deferred to idle in src/App.tsx.
 */
import { markUntracked, forgetInterval, __DEV_internals } from "./runtime.registry";
import { inferCategoryFromStack, inferOwnerFromStack } from "./runtime.lattice";

const IS_DEV = (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;

let installed = false;

export function installRuntimeObserver(): void {
  if (!IS_DEV) return;
  if (installed) return;
  if (typeof window === "undefined") return;
  installed = true;

  const nativeSet = window.setInterval.bind(window);
  const nativeClear = window.clearInterval.bind(window);

  // Re-binding window.setInterval. TS lib types are strict; cast through unknown.
  (window as unknown as { setInterval: typeof window.setInterval }).setInterval =
    function (handler: TimerHandler, timeout?: number, ...args: unknown[]) {
      const id = (nativeSet as (h: TimerHandler, t?: number, ...a: unknown[]) => number)(handler, timeout, ...args);
      try {
        const internals = __DEV_internals();
        if (internals && !internals.tracked.has(id)) {
          const stack = new Error("interval-trace").stack;
          markUntracked(id, {
            owner: inferOwnerFromStack(stack),
            intervalMs: Number(timeout ?? 0),
            category: inferCategoryFromStack(stack),
            createdAt: Date.now(),
            stack,
          });
        }
      } catch { /* swallow — visibility must not break runtime */ }
      return id;
    } as typeof window.setInterval;

  (window as unknown as { clearInterval: typeof window.clearInterval }).clearInterval =
    function (id?: number) {
      try { if (typeof id === "number") forgetInterval(id); } catch { /* noop */ }
      return (nativeClear as (id?: number) => void)(id);
    } as typeof window.clearInterval;
}

// Auto-install on import (side-effect). Caller still gets explicit fn for tests.
installRuntimeObserver();
