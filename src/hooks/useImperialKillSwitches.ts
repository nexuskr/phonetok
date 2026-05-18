// IMPERIAL-SINGULARITY v3.5-H: imperial_* kill switches subscription.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWalletChannel } from "@pkg/realtime";
import { setVisibleInterval } from "@/lib/util/visible-interval";

export type ImperialKill = {
  imperial_betting: boolean;
  imperial_flywheel: boolean;
  imperial_withdrawal: boolean;
  imperial_burn: boolean;
  imperial_nft_mint: boolean;
  reasons: Partial<Record<string, string>>;
  loaded: boolean;
};

const DEFAULT: ImperialKill = {
  imperial_betting: false, imperial_flywheel: false, imperial_withdrawal: false,
  imperial_burn: false, imperial_nft_mint: false, reasons: {}, loaded: false,
};

export function useImperialKillSwitches(): ImperialKill {
  const [state, setState] = useState<ImperialKill>(DEFAULT);

  async function refresh() {
    try {
      const { data, error } = await (supabase as any)
        .from("imperial_kill_switches").select("key, enabled, reason");
      if (error) throw error;
      const next: ImperialKill = { ...DEFAULT, loaded: true, reasons: {} };
      for (const r of data ?? []) {
        if (r.key in next) {
          (next as any)[r.key] = !!r.enabled;
          if (r.enabled && r.reason) (next.reasons as any)[r.key] = r.reason;
        }
      }
      setState(next);
    } catch {
      setState((s) => ({ ...s, loaded: true }));
    }
  }

  useWalletChannel("imperial-kill", (ch) => {
    ch.on("postgres_changes",
      { event: "*", schema: "public", table: "imperial_kill_switches" },
      () => refresh());
  });

  useEffect(() => {
    refresh();
    const stop = setVisibleInterval(refresh, 30_000, { meta: { owner: "useImperialKillSwitches", category: "admin" } });
    return () => stop();
  }, []);

  return state;
}
