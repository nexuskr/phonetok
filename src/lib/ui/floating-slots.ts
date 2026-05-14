/**
 * Floating UI single-source-of-truth.
 *
 * 모든 fixed-position 위젯(SimGlobalBadge, PowerHeader, EmpireBoosterTimer,
 * FloatingChat, FloatingCashLoopWidget, LivePurchaseTicker …)은 여기 정의된
 * SLOT 호스트로 portal 되어, 같은 코너에서 자동으로 vertical stack 된다.
 *
 * Z-INDEX SCALE — 절대 직접 z-* 클래스를 쓰지 말고 Z 상수만 사용할 것.
 *  hud   = 60  : non-blocking HUD (booster timer, power chip)
 *  badge = 70  : SIM 배지, status badge
 *  toast = 80  : transient notifications (sonner level)
 *  modal = 90  : true modal / dialog overlays
 *
 * SLOT 호스트는 App 루트(`<FloatingDockHost />`)에 1회 mount.
 * 각 위젯은 `<FloatingSlot slot="..." order={n}>` 으로 안에 portal.
 *
 * 모바일 안전영역: `--bottom-nav-h` + `env(safe-area-inset-bottom)`를 바탕으로
 * bottom 슬롯이 자동으로 위로 들림. 데스크탑에선 nav 바가 없으므로 그냥 화면
 * 하단 16px gap.
 */

export const Z = {
  hud: 60,
  badge: 70,
  toast: 80,
  modal: 90,
} as const;

export const SLOT_IDS = {
  topRight: "phonara-slot-top-right",
  bottomRight: "phonara-slot-bottom-right",
  bottomLeft: "phonara-slot-bottom-left",
} as const;

export type SlotKey = keyof typeof SLOT_IDS;

export function getSlotElement(slot: SlotKey): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.getElementById(SLOT_IDS[slot]);
}

/* ───────── Dismiss memory (sessionStorage) ───────── */

const DISMISS_PREFIX = "fs_dismiss_";

export function isSlotDismissed(key: string): boolean {
  try {
    if (typeof sessionStorage === "undefined") return false;
    return sessionStorage.getItem(DISMISS_PREFIX + key) === "1";
  } catch {
    return false;
  }
}

export function dismissSlot(key: string): void {
  try {
    sessionStorage.setItem(DISMISS_PREFIX + key, "1");
    window.dispatchEvent(new CustomEvent("fs:dismiss", { detail: key }));
  } catch {
    /* noop */
  }
}

export function resetSlotDismiss(key: string): void {
  try {
    sessionStorage.removeItem(DISMISS_PREFIX + key);
  } catch {
    /* noop */
  }
}
