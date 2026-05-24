import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function AuthCallback() {
  const nav = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      nav(data.session ? "/home" : "/auth", { replace: true });
    });
  }, [nav]);
  return (
    <main className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">로그인 중...</p>
    </main>
  );
}
