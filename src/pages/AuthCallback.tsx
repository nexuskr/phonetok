import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LoadingPage } from "@/components/ui/loading-state";
import { notify } from "@/lib/notify";

/**
 * Handles Magic Link / OAuth callback. Supabase places the session info in
 * either the URL hash (#access_token=...) or as a `?code=...` PKCE param.
 */
export default function AuthCallback() {
  const nav = useNavigate();
  const [msg, setMsg] = useState("로그인 확인 중…");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (error) throw error;
        }
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session) {
          // First-time profile completion check
          const uid = data.session.user.id;
          const { data: prof } = await supabase
            .from("profiles")
            .select("profile_completed")
            .eq("id", uid)
            .maybeSingle();
          notify.success("로그인 완료");
          nav(prof?.profile_completed ? "/dashboard" : "/complete-profile", { replace: true });
        } else {
          setMsg("세션을 찾을 수 없습니다. 다시 시도해주세요.");
          setTimeout(() => nav("/secure-auth", { replace: true }), 2000);
        }
      } catch (e: any) {
        notify.error("로그인 실패", { description: e?.message ?? "잠시 후 다시 시도해주세요." });
        setTimeout(() => nav("/secure-auth", { replace: true }), 1500);
      }
    })();
    return () => { cancelled = true; };
  }, [nav]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="glass-strong rounded-2xl p-8 max-w-sm w-full text-center">
        <LoadingPage label={msg} />
      </div>
    </div>
  );
}
