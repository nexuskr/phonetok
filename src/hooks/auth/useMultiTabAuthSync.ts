// P0-8 — Multi-tab auth sync (App 루트 마운트)

import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  publishAuthEvent,
  subscribeAuthEvents,
  TAB_ID,
  type AuthBroadcastPayload,
} from "@/lib/auth/authBroadcast";
import {
  startSessionHealthHeartbeat,
  stopSessionHealthHeartbeat,
} from "@/lib/auth/sessionHealth";
import { invalidateSessionCache } from "@/lib/auth/authSingleFlight";
import { loadDB, saveDB } from "@/lib/store";

const RELEVANT = new Set(["SIGNED_IN", "SIGNED_OUT", "TOKEN_REFRESHED"]);

export function useMultiTabAuthSync() {
  useEffect(() => {
    let mounted = true;
    startSessionHealthHeartbeat();

    // 1) 우리 탭 → 다른 탭으로 전파
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (!RELEVANT.has(event)) return;
      publishAuthEvent(event as any, {
        hasSession: !!session,
        userId: session?.user?.id ?? null,
      });
    });

    // 2) 다른 탭 → 우리 탭 수신
    const off = subscribeAuthEvents((p: AuthBroadcastPayload) => {
      if (!mounted) return;
      // heartbeat 이벤트는 peer 추적용으로만 사용
      if (p?.meta && (p.meta as any).hb === 1) return;

      if (p.type === "SIGNED_OUT") {
        invalidateSessionCache();
        try {
          const db = loadDB();
          if (db.user) saveDB({ ...db, user: null });
        } catch { /* noop */ }
        // 강제 reload 없이 Supabase SDK 의 자체 SIGNED_OUT 이벤트가 UI 를 자연스럽게 갱신
      }
      if (
        p.type === "SIGNED_IN" ||
        p.type === "TOKEN_REFRESHED" ||
        p.type === "RECOVER_401"
      ) {
        invalidateSessionCache();
      }
    });

    return () => {
      mounted = false;
      off();
      sub.subscription.unsubscribe();
      stopSessionHealthHeartbeat();
    };
  }, []);
}

export { TAB_ID };
