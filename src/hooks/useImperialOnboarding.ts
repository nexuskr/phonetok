import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getFingerprint } from "@/lib/deviceFingerprint";

export type OnboardingState = {
  signup_claimed: boolean;
  daily_claimed_today: boolean;
  next_reset_at?: string;
  total_granted_phon?: number;
};

async function sha256Hex(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const h = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function useImperialOnboarding() {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("imperial_get_onboarding_state");
      if (error) throw error;
      setState((data as unknown as OnboardingState) ?? null);
    } catch {
      setState(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const claimSignup = useCallback(async () => {
    // Collect device fingerprint + UA hash (IP hash unavailable client-side; server gets request IP via headers if needed)
    let _device_fp: string | null = null;
    let _ua_hash: string | null = null;
    try { _device_fp = await getFingerprint(); } catch {}
    try { _ua_hash = await sha256Hex((navigator.userAgent ?? "").slice(0, 512)); } catch {}

    const { data, error } = await supabase.rpc("imperial_claim_signup_bonus", {
      _device_fp,
      _ip_hash: null,
      _ua_hash,
    } as any);
    if (error) throw error;
    await refresh();
    return data as { status: string; amount_phon?: number; new_balance?: number };
  }, [refresh]);

  const claimDaily = useCallback(async () => {
    const { data, error } = await supabase.rpc("imperial_claim_daily_login_bonus");
    if (error) throw error;
    await refresh();
    return data as { status: string; amount_phon?: number; new_balance?: number };
  }, [refresh]);

  return { state, loading, refresh, claimSignup, claimDaily };
}
