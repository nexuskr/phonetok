import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { hasVerifiedSession } from "@/lib/auth-recovery";

export function useAuthReady() {
  const [isReady, setIsReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let active = true;

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "SIGNED_OUT" || !session?.user) {
        setHasSession(false);
        setIsReady(true);
        return;
      }

      void hasVerifiedSession().then((ok) => {
        if (!active) return;
        setHasSession(ok);
        setIsReady(true);
      });
    });

    hasVerifiedSession()
      .then((ok) => {
        if (!active) return;
        setHasSession(ok);
        setIsReady(true);
      })
      .catch(() => {
        if (!active) return;
        setHasSession(false);
        setIsReady(true);
      });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return { isReady, hasSession };
}
