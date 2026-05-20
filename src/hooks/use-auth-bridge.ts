import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadDB, saveDB, type Tier } from "@/lib/store";
import { registerCurrentDevice } from "@/lib/deviceFingerprint";
import { isInvalidSessionError, clearBrokenLocalSession } from "@/lib/auth-recovery";
import { verifySessionOnce, invalidateSessionCache } from "@/lib/auth/authSingleFlight";

const RESETTABLE_SESSION_FLAGS = [
  "phonara_disable_dashboard_state_rpc",
  "phonara_disable_achievement_rpc",
  "phonara_disable_fomo_rpc",
  "phonara_disable_persona_rpc",
  "phonara_disable_persona_missions_rpc",
  "phonara_disable_register_device_rpc",
] as const;

const TIER_MAP: Record<string, Tier> = {
  normal: "NORMAL", vip: "VIP", god: "GOD", empire: "EMPIRE",
  NORMAL: "NORMAL", VIP: "VIP", GOD: "GOD", EMPIRE: "EMPIRE",
};

async function syncFromSession(session: any) {
  const db = loadDB();
  if (!session?.user) {
    if (db.user) saveDB({ ...db, user: null });
    return;
  }
  const uid = session.user.id;
  const email = session.user.email ?? "";
  const [{ data: profile }, { data: roles }, { data: wallet }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", uid),
    supabase.from("wallet_balances").select("*").eq("user_id", uid).maybeSingle(),
  ]);
  const tier = TIER_MAP[(profile as any)?.tier ?? "normal"] ?? "NORMAL";
  const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
  const merged = {
    id: uid,
    email,
    nickname: (profile as any)?.nickname ?? email.split("@")[0] ?? "User",
    phone: (profile as any)?.phone ?? "",
    realName: (profile as any)?.real_name ?? "",
    birth: (profile as any)?.birth_date ?? "",
    balance: Number((wallet as any)?.available_balance ?? 0),
    coinBalance: 0,
    todayEarnings: Number((wallet as any)?.today_earned ?? 0),
    streak: Number((profile as any)?.attendance_streak ?? 0),
    level: tier === "EMPIRE" ? 60 : tier === "GOD" ? 30 : tier === "VIP" ? 10 : 1,
    xp: 0,
    tier,
    isAdmin,
    badges: db.user?.badges ?? [],
    lastAttendance: (profile as any)?.last_attendance ?? undefined,
    attendanceStreak: Number((profile as any)?.attendance_streak ?? 0),
  };
  saveDB({ ...db, user: merged as any });
}

function resetSessionCircuitBreakers() {
  try {
    RESETTABLE_SESSION_FLAGS.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // no-op
  }
}

async function assignPersonaSafely() {
  try {
    if (sessionStorage.getItem("phonara_disable_persona_rpc") === "1") return;
    // P0-3: single-flight 로 세션 검증 — /user 중복 호출 제거
    const user = await verifySessionOnce();
    if (!user) return;
    const { error } = await supabase.rpc("assign_persona" as any);
    if (error) {
      sessionStorage.setItem("phonara_disable_persona_rpc", "1");
      console.warn("[auth-bridge] assign_persona disabled:", error.message ?? error);
    }
  } catch {
    // best-effort only
  }
}

/**
 * Stale-token guard: 토큰은 살아있지만 user fetch가 403 bad_jwt(missing sub claim)을
 * 반환하는 도메인 cross-storage 케이스. 감지 시 로컬 세션만 정리하고 사용자에게
 * 안내(즉시 무한 루프 회피).
 *
 * P0-3: single-flight 캐시 사용 — /user 중복 호출 0
 */
async function ensureValidSession(session: any): Promise<boolean> {
  if (!session?.user) return false;
  const user = await verifySessionOnce();
  return !!user?.id;
}

function isOnGuide(): boolean {
  return typeof window !== "undefined" && window.location.pathname.startsWith("/guide");
}

export function useAuthBridge() {
  useEffect(() => {
    let mounted = true;
    // P0-3: SIGNED_IN/TOKEN_REFRESHED/INITIAL_SESSION 모두 처리.
    // INITIAL_SESSION 이 Supabase v2 에서 자동 발사되므로 getSession() 별도 호출 제거.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      // 모든 이벤트에서 single-flight 캐시 무효화
      invalidateSessionCache();
      // Defer to avoid deadlock
      setTimeout(() => { if (mounted && !isOnGuide()) syncFromSession(session); }, 0);
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION")
          && session?.user && !isOnGuide()) {
        resetSessionCircuitBreakers();
        setTimeout(() => { if (mounted && !isOnGuide()) void registerCurrentDevice(); }, 500);
        setTimeout(() => { if (mounted && !isOnGuide()) void assignPersonaSafely(); }, 800);
      }
      if (event === "SIGNED_OUT") {
        // bad_jwt 자동 정리 후 자연스러운 SIGNED_OUT — 강제 리다이렉트 X
        syncFromSession(null);
      }
    });
    // P0-3: INITIAL_SESSION 이벤트가 자동 발사되므로 getSession() 폴백만 안전망으로 유지.
    // single-flight 가 중복 /user 호출을 막아준다.
    if (!isOnGuide()) {
      void (async () => {
        try {
          const user = await verifySessionOnce();
          if (!mounted || isOnGuide()) return;
          if (!user) { syncFromSession(null); return; }
          // INITIAL_SESSION 핸들러가 아직 실행되지 않았을 경우의 폴백.
          // syncFromSession 은 idempotent.
          const { data } = await supabase.auth.getSession();
          if (!mounted) return;
          syncFromSession(data.session);
        } catch (e) {
          if (isInvalidSessionError(e)) await clearBrokenLocalSession();
        }
      })();
    }
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);
}

