import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useAuthReady() {
  const [isReady, setIsReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let active = true;

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setHasSession(!!session?.user);
      setIsReady(true);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setHasSession(!!data.session?.user);
      setIsReady(true);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return { isReady, hasSession };
}