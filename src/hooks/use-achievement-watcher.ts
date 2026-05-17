import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";
import { shouldTripCircuit, tripCircuit, isCircuitTripped } from "@/lib/rpc-circuit";
import { getVerifiedUser } from "@/lib/auth-recovery";

const ACHIEVEMENT_RPC_DISABLED_KEY = "phonara_disable_achievement_rpc";

// Module-scope dedupe: at most one in-flight check, and a 10s minimum gap
// regardless of how many components mount the hook or how many focus events fire.
const ACHIEVEMENT_DEDUPE_MS = 10_000;
let achievementLastAt = 0;
let achievementInflight: Promise<string[]> | null = null;
const seenUnlocks = new Set<string>();

async function runAchievementCheck(): Promise<string[]> {
  if (isCircuitTripped(ACHIEVEMENT_RPC_DISABLED_KEY)) return [];
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/guide")) return [];
  const now = Date.now();
  if (now - achievementLastAt < ACHIEVEMENT_DEDUPE_MS) return [];
  if (achievementInflight) return achievementInflight;

  achievementInflight = (async () => {
    try {
      const user = await getVerifiedUser();
      if (!user) return [];
      const { data, error } = await supabase.rpc("check_achievements", { _user_id: user.id });
      if (error || !data) {
        if (error && shouldTripCircuit(error)) tripCircuit(ACHIEVEMENT_RPC_DISABLED_KEY);
        return [];
      }
      achievementLastAt = Date.now();
      const unlocked: string[] = ((data as any)?.unlocked ?? []).filter(Boolean);
      const fresh: string[] = [];
      for (const key of unlocked) {
        if (seenUnlocks.has(key)) continue;
        seenUnlocks.add(key);
        fresh.push(key);
      }
      return fresh;
    } catch {
      return [];
    } finally {
      achievementInflight = null;
    }
  })();
  return achievementInflight;
}

/**
 * Calls check_achievements after key user actions and toasts any newly
 * unlocked badges. Pass `trigger` (e.g. timestamp) to re-run on demand,
 * or rely on the focus/visibility hooks for ambient checks.
 */
export function useAchievementWatcher(trigger?: unknown) {
  useEffect(() => {
    let cancelled = false;
    async function check() {
      const fresh = await runAchievementCheck();
      if (cancelled) return;
      for (const key of fresh) {
        notify.success("🏆 업적 달성!", {
          description: key,
          duration: 5000,
        });
      }
    }
    void check();
    const onFocus = () => { void check(); };
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, [trigger]);
}
