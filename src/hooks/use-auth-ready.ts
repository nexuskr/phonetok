import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { verifySessionOnce } from "@/lib/auth/authSingleFlight";

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
      // P0-3: single-flight 캐시. /user 폭주 차단.
      void verifySessionOnce().then((user) => {
        if (!active) return;
        setHasSession(!!user);
        setIsReady(true);
      });
    });

    verifySessionOnce()
      .then((user) => {
        if (!active) return;
        setHasSession(!!user);
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
