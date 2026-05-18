// IMPERIAL-SINGULARITY v3.5-H: current user's NFT tier + lifetime burn.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWalletChannel } from "@pkg/realtime";
import type { ImperialNftTier } from "@/lib/imperialNft";

export type ImperialUserNft = {
  tier: ImperialNftTier;
  lifetimeBurn: number;
  lastUpgradedAt: string | null;
  loaded: boolean;
};

export function useImperialUserNft(): ImperialUserNft {
  const [s, setS] = useState<ImperialUserNft>({ tier: 0, lifetimeBurn: 0, lastUpgradedAt: null, loaded: false });

  async function refresh() {
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      if (!uid) { setS((x) => ({ ...x, loaded: true })); return; }
      const { data } = await (supabase as any)
        .from("imperial_user_nfts").select("tier, lifetime_burn, last_upgraded_at")
        .eq("user_id", uid).maybeSingle();
      setS({
        tier: (data?.tier ?? 0) as ImperialNftTier,
        lifetimeBurn: Number(data?.lifetime_burn ?? 0),
        lastUpgradedAt: data?.last_upgraded_at ?? null,
        loaded: true,
      });
    } catch {
      setS((x) => ({ ...x, loaded: true }));
    }
  }

  useWalletChannel("imperial-user-nft", (ch) => {
    ch.on("postgres_changes",
      { event: "*", schema: "public", table: "imperial_user_nfts" },
      () => refresh());
  });

  useEffect(() => { refresh(); }, []);
  return s;
}
