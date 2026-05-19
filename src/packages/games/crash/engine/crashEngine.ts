/**
 * crashEngine — rAF-driven multiplier ticker.
 *
 * Pure math + lifecycle; never touches DOM, money RPCs, or state libs.
 * Used by the Imperial canvas to interpolate between server polls so the
 * gold rocket never stutters even on 120Hz displays.
 *
 *   m(t) = GROWTH_BASE ^ t       (Stake-equivalent exponential growth)
 *
 * GROWTH_BASE = 1.06 per second matches the server's `liveMultiplier()`
 * curve in `@/lib/crash`, so client and server agree to ~3 decimal places
 * within the first 30 seconds.
 */

export const GROWTH_BASE = 1.06;
export const SAFE_CEIL = 1_000_000;

export function multiplierAt(elapsedMs: number): number {
  if (elapsedMs <= 0) return 1;
  const m = Math.pow(GROWTH_BASE, elapsedMs / 1000);
  return Math.min(SAFE_CEIL, Math.max(1, m));
}

export function timeForMultiplier(target: number): number {
  if (target <= 1) return 0;
  return (Math.log(target) / Math.log(GROWTH_BASE)) * 1000;
}

export interface CrashEngineOptions {
  onTick: (multiplier: number, elapsedMs: number) => void;
  onCrash?: (finalMultiplier: number) => void;
  ceiling?: number;
  /** Server-wall-clock offset in ms (Date.now() - serverNow). */
  serverOffsetMs?: number;
}

export interface CrashEngineHandle {
  start: (startedAt: number) => void;
  stop: () => void;
  crash: (finalMultiplier: number) => void;
  isRunning: () => boolean;
}

export function createCrashEngine(opts: CrashEngineOptions): CrashEngineHandle {
  let raf = 0;
  let running = false;
  let startedAt = 0;
  const ceiling = opts.ceiling ?? SAFE_CEIL;
  const offset = opts.serverOffsetMs ?? 0;

  const loop = () => {
    if (!running) return;
    const now = Date.now() - offset;
    const elapsed = now - startedAt;
    const m = multiplierAt(elapsed);
    opts.onTick(m, elapsed);
    if (m >= ceiling) {
      running = false;
      opts.onCrash?.(m);
      return;
    }
    raf = requestAnimationFrame(loop);
  };

  return {
    start(s) {
      startedAt = s;
      running = true;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    crash(finalM) {
      running = false;
      cancelAnimationFrame(raf);
      opts.onCrash?.(finalM);
    },
    isRunning: () => running,
  };
}
