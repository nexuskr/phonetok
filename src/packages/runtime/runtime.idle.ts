/**
 * @pkg/runtime/runtime.idle — PR-H Idle Suspension.
 *
 * After 60s of no user input (and tab visible), pause category="admin"
 * cooperatively via governor.pauseCategory. Any input resumes immediately.
 *
 * - Cosmetic: governed separately by hidden-tab suspension (PR-G).
 * - Money-flow: raw setInterval, governor does not touch it.
 * - Admin: governed here. tick() in setVisibleInterval skips while paused.
 *
 * Idempotent install. Inert in SSR.
 */
import { pauseCategory, resumeCategory } from "./runtime.governor";

const IDLE_MS = 60_000;
let installed = false;
let lastInput = Date.now();
let idle = false;

function markActive() {
  lastInput = Date.now();
  if (idle) {
    idle = false;
    resumeCategory("admin");
  }
}

function tick() {
  if (typeof document === "undefined" || document.hidden) return;
  if (!idle && Date.now() - lastInput > IDLE_MS) {
    idle = true;
    pauseCategory("admin");
  }
}

export function installIdleSuspension(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  (["pointerdown", "keydown", "scroll", "touchstart", "mousemove"] as const).forEach((ev) =>
    window.addEventListener(ev, markActive, { passive: true })
  );
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) markActive(); // returning to tab = active
  });
  // 5s poll keeps wakeup precision while staying cheap.
  window.setInterval(tick, 5_000);
}

export function isIdle(): boolean {
  return idle;
}
