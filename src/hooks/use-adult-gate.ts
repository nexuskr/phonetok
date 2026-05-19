import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// 19+ 인증을 마치지 않은 로그인 사용자는 /complete-profile 로 강제 이동.
// 공개/인증/완성 페이지에서는 동작하지 않음.
const EXEMPT = [
  "/", "/auth", "/secure-auth", "/auth/callback",
  "/forgot-password", "/reset-password", "/complete-profile",
  "/unsubscribe", "/trust", "/status", "/c", "/vision",
];

function isExempt(path: string) {
  if (EXEMPT.includes(path)) return true;
  return EXEMPT.some((p) => p !== "/" && path.startsWith(p + "/"));
}

export function useAdultGate() {
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isExempt(loc.pathname)) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return; // 비로그인은 통과 (각 라우트의 자체 보호에 위임)
      // Tolerant: 백엔드에 is_adult/profile_completed 컬럼이 없거나 SELECT가 400을
      // 던지면(독립 백엔드 스키마 drift) 사용자를 강제로 /complete-profile 로 보내지
      // 않는다. 명시적으로 "둘 중 하나가 false"로 확인된 경우에만 리다이렉트.
      let profile: any = null;
      try {
        const r = await supabase
          .from("profiles")
          .select("is_adult, birth_date, profile_completed")
          .eq("id", session.user.id)
          .maybeSingle();
        if (r.error) return; // 스키마/권한 문제 — 게이트 미적용
        profile = r.data;
      } catch {
        return; // 네트워크/스키마 예외 — 게이트 미적용
      }
      if (cancelled) return;
      // 행이 아예 없으면(트리거 미작동 + 신규) 한 번 입력 페이지로 안내.
      if (!profile) {
        if (loc.pathname !== "/complete-profile") {
          nav("/complete-profile", { replace: true });
        }
        return;
      }
      if (profile.profile_completed === false || profile.is_adult === false) {
        nav("/complete-profile", { replace: true });
      }
    })();
    return () => { cancelled = true; };
  }, [loc.pathname, nav]);
}
