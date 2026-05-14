/**
 * FloatingDock — single-source-of-truth host + portal slot for floating widgets.
 *
 * Usage:
 *   1) Mount `<FloatingDockHost />` ONCE at the App root.
 *   2) From any floating widget render:
 *
 *        <FloatingSlot slot="topRight" order={1}>
 *          <YourChip />
 *        </FloatingSlot>
 *
 *   - Children inside the same slot stack vertically with 12px gap.
 *   - `order` lets you control vertical ordering (lower = closer to corner).
 *   - The host divs handle safe-area + bottom-nav offset automatically.
 *
 * NEVER use `fixed` positioning directly in floating widgets after this is
 * adopted. All positioning flows through this dock.
 */

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { SLOT_IDS, Z, type SlotKey, getSlotElement } from "@/lib/ui/floating-slots";

/* ───────── Slot host (mount ONCE in App root) ───────── */

export function FloatingDockHost() {
  return (
    <>
      {/* TOP RIGHT — SIM badge, PowerHeader, EmpireBoosterTimer */}
      <div
        id={SLOT_IDS.topRight}
        aria-hidden="true"
        className="fixed top-2 right-2 flex flex-col items-end gap-2 pointer-events-none max-w-[calc(100vw-1rem)]"
        style={{
          zIndex: Z.badge,
          paddingTop: "env(safe-area-inset-top)",
        }}
      />

      {/* BOTTOM RIGHT — FloatingChat FAB, FloatingCashLoopWidget */}
      <div
        id={SLOT_IDS.bottomRight}
        aria-hidden="true"
        className="fixed right-3 flex flex-col items-end gap-3 pointer-events-none max-w-[min(calc(100vw-1.5rem),420px)]"
        style={{
          zIndex: Z.hud,
          bottom:
            "calc(var(--bottom-nav-h, 0px) + env(safe-area-inset-bottom) + 0.75rem)",
        }}
      />

      {/* BOTTOM LEFT — LivePurchaseTicker, etc. */}
      <div
        id={SLOT_IDS.bottomLeft}
        aria-hidden="true"
        className="fixed left-3 flex flex-col items-start gap-2 pointer-events-none max-w-[min(calc(100vw-1.5rem),360px)]"
        style={{
          zIndex: Z.hud,
          bottom:
            "calc(var(--bottom-nav-h, 0px) + env(safe-area-inset-bottom) + 0.75rem)",
        }}
      />
    </>
  );
}

/* ───────── Slot consumer ───────── */

export function FloatingSlot({
  slot,
  order = 0,
  children,
  className = "",
}: {
  slot: SlotKey;
  order?: number;
  children: ReactNode;
  /** Optional className applied to the inline portal wrapper. */
  className?: string;
}) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  // Resolve host on mount (and once if it appears late after hydration).
  useEffect(() => {
    let cancelled = false;
    const tryGet = () => {
      const el = getSlotElement(slot);
      if (el) {
        setHost(el);
        return true;
      }
      return false;
    };
    if (tryGet()) return;
    let frame = 0;
    const tick = () => {
      if (cancelled) return;
      if (tryGet()) return;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (frame) cancelAnimationFrame(frame);
    };
  }, [slot]);

  if (!host) return null;

  return createPortal(
    <div
      data-fs-order={order}
      className={`pointer-events-auto ${className}`}
      style={{ order }}
    >
      {children}
    </div>,
    host,
  );
}
