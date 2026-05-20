/**
 * P0-7 — useFillBroadcast
 *
 * React adapter around `claimFilledToast`. Returns stable `claim(id)`.
 * Gate filled-side effects:
 *
 *   const claim = useFillBroadcast();
 *   if (claim(row.id)) { notify.success(...); fireBurst(...); }
 */
import { useCallback } from "react";
import { claimFilledToast } from "@/lib/deposit/depositToastDedupe";

export function useFillBroadcast() {
  return useCallback((id: string | null | undefined) => claimFilledToast(id), []);
}
