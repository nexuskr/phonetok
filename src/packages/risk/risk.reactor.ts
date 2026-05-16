/**
 * @pkg/risk/risk.reactor — Phase 4 SYSTEM_DEGRADE entry point (STUB).
 *
 * Future: subscribes to WS health / FPS / memory signals and invokes
 * risk.kill-switch / risk.degrade. Inert in Phase 2.
 */
export type DegradeReason =
  | "ws_reconnect_storm"
  | "low_fps"
  | "low_memory"
  | "manual";

export function reactDegrade(_reason: DegradeReason): void {
  // Phase 4 will implement.
}
