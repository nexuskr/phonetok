// P0-8 — 401 silent recovery wrapper

import { supabase } from "@/integrations/supabase/client";
import { safeRefreshSession } from "./refreshMutex";
import { publishAuthEvent } from "./authBroadcast";
import { recordRecover401 } from "./sessionHealth";

function looksLike401(err: unknown): boolean {
  if (!err) return false;
  const anyErr = err as any;
  const status = anyErr?.status ?? anyErr?.code;
  if (status === 401 || status === "401") return true;
  const msg = String(anyErr?.message ?? anyErr ?? "").toLowerCase();
  return (
    msg.includes("jwt expired") ||
    msg.includes("invalid jwt") ||
    msg.includes("bad_jwt") ||
    msg.includes("missing sub claim") ||
    msg.includes("unauthorized")
  );
}

async function gracefulSignOut(): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: "local" } as any);
  } catch { /* noop */ }
  publishAuthEvent("SIGNED_OUT", { reason: "recover401_failed" });
}

/**
 * 401-aware 재시도 래퍼. fn 이 401을 던지면 single-flight refresh 후 1회 재실행.
 * 두 번째도 실패하면 graceful local signOut 후 원래 에러를 던진다.
 */
export async function recoverFrom401<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!looksLike401(err)) throw err;

    const session = await safeRefreshSession();
    if (!session) {
      recordRecover401(false);
      await gracefulSignOut();
      throw err;
    }

    try {
      const out = await fn();
      recordRecover401(true);
      publishAuthEvent("RECOVER_401", { ok: true });
      return out;
    } catch (err2) {
      recordRecover401(false);
      if (looksLike401(err2)) {
        await gracefulSignOut();
      }
      throw err2;
    }
  }
}

export const __test_only = { looksLike401 };
