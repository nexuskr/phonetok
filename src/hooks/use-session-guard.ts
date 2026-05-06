import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const INACTIVITY_MS = 60 * 60 * 1000; // 1 hour
const STORAGE_KEY = "pm_last_activity";

/**
 * Tracks user activity and auto-logs out after 1 hour of inactivity.
 * Mount once at the App root.
 */
export function useSessionGuard() {
  useEffect(() => {
    const update = () => localStorage.setItem(STORAGE_KEY, String(Date.now()));
    update();

    const events = ["mousedown", "keydown", "touchstart", "scroll", "visibilitychange"];
    events.forEach(e => window.addEventListener(e, update, { passive: true }));

    const interval = setInterval(async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const last = Number(localStorage.getItem(STORAGE_KEY) || Date.now());
      if (Date.now() - last > INACTIVITY_MS) {
        await supabase.auth.signOut();
        toast({ title: "자동 로그아웃", description: "1시간 이상 활동이 없어 보안을 위해 로그아웃되었습니다." });
        localStorage.removeItem(STORAGE_KEY);
        window.location.href = "/secure-auth";
      }
    }, 30 * 1000);

    return () => {
      events.forEach(e => window.removeEventListener(e, update));
      clearInterval(interval);
    };
  }, []);
}
