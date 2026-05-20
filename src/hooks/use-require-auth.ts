import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useDB } from "@/lib/store";
import { useAuthReady } from "./use-auth-ready";
import { supabase } from "@/integrations/supabase/client";

// P0-3: redirect loop guard — 이미 인증 페이지에 있으면 nav 호출하지 않음.
const AUTH_ROUTES = new Set<string>(["/auth", "/secure-auth", "/auth/callback", "/forgot-password", "/reset-password"]);

function gotoAuth(nav: ReturnType<typeof useNavigate>, fromPath: string) {
  if (AUTH_ROUTES.has(fromPath)) return; // loop guard
  const returnTo = encodeURIComponent(fromPath || "/");
  nav(`/secure-auth?returnTo=${returnTo}`, { replace: true });
}

export function useRequireAuth() {
  const [db] = useDB();
  const nav = useNavigate();
  const loc = useLocation();
  const { isReady, hasSession } = useAuthReady();

  useEffect(() => {
    if (!isReady) return;
    if (!hasSession) gotoAuth(nav, loc.pathname);
  }, [hasSession, isReady, nav, loc.pathname]);

  return isReady ? db.user : undefined;
}

export function useRequireAdmin() {
  const [db] = useDB();
  const nav = useNavigate();
  const loc = useLocation();
  const { isReady, hasSession } = useAuthReady();
  const [serverAdmin, setServerAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isReady) return;
    if (!hasSession) {
      gotoAuth(nav, loc.pathname);
      return;
    }
    // Server-side admin verification — never trust localStorage alone.
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { if (mounted) setServerAdmin(false); return; }
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: session.user.id,
        _role: "admin",
      });
      if (!mounted) return;
      const ok = !error && data === true;
      setServerAdmin(ok);
      if (!ok) nav("/dashboard", { replace: true });
    })();
    return () => { mounted = false; };
  }, [hasSession, isReady, nav, loc.pathname]);

  if (!isReady || serverAdmin !== true) return undefined;
  return db.user;
}
