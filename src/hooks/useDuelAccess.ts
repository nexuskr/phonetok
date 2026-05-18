/**
 * IMPERIAL-SINGULARITY: useDuelAccess — limited rollout gate for PHON Real Betting.
 * Admins and holders of the 'duel_internal' beta code can access; others see locked state.
 * Read-only entitlement check — does NOT touch money-flow paths.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const CACHE_KEY = "phonara:duel_access:v1";
const TTL_MS = 5 * 60 * 1000;

type CachedAccess = { allowed: boolean; reason: string; at: number };

export function useDuelAccess() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState<boolean>(false);
  const [reason, setReason] = useState<string>("checking");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (raw) {
          const c = JSON.parse(raw) as CachedAccess;
          if (Date.now() - c.at < TTL_MS) {
            if (!cancelled) { setAllowed(c.allowed); setReason(c.reason); setLoading(false); }
            return;
          }
        }
      } catch { /* ignore */ }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) { setAllowed(false); setReason("not_authenticated"); setLoading(false); }
        return;
      }

      // Admin always allowed
      const { data: roleRows } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (roleRows) {
        const v: CachedAccess = { allowed: true, reason: "admin", at: Date.now() };
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(v));
        if (!cancelled) { setAllowed(true); setReason("admin"); setLoading(false); }
        return;
      }

      // Beta invite holders — convention: invite.note starts with "duel_internal"
      const { data: redemptions } = await supabase
        .from("beta_redemptions")
        .select("invite_id, beta_invites!inner(note)")
        .eq("user_id", user.id);
      const ok = !!redemptions?.some((r: any) =>
        typeof r?.beta_invites?.note === "string" && r.beta_invites.note.startsWith("duel_internal")
      );
      const v: CachedAccess = { allowed: ok, reason: ok ? "beta" : "not_invited", at: Date.now() };
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(v)); } catch { /* ignore */ }
      if (!cancelled) { setAllowed(ok); setReason(v.reason); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  return { loading, allowed, reason };
}
