/**
 * Phase 4 Sprint 3 — @pkg/native barrel
 * --------------------------------------
 * 모바일 네이티브 감각 프리미티브.
 * - transform + opacity only animation
 * - graceful degradation (저사양/reduced-motion/iOS Safari no-vibrate)
 * - money-flow / RPC 미연결 (순수 cosmetic + UX)
 */
export { useHaptic, triggerHaptic, disableHaptic, type HapticKind } from "./useHaptic";
export { usePullToRefresh } from "./usePullToRefresh";
export { useSwipeGesture } from "./useSwipeGesture";
export { useDynamicIsland, dynamicIsland, type IslandKind, type IslandState } from "./useDynamicIsland";
export { DynamicIslandPill } from "./components/DynamicIslandPill";
export { PullToRefreshIndicator } from "./components/PullToRefreshIndicator";
export { NearMissOverlay } from "./components/NearMissOverlay";
export { MultiplierCountUp } from "./components/MultiplierCountUp";
