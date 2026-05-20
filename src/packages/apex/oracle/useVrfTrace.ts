// Read-only VRF trace fetch (Drand + Ed25519 attestation).
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type VrfTrace = {
  id: string;
  game: string;
  round_ref: string;
  drand_round: number | null;
  drand_randomness: string | null;
  server_signature: string | null;
  server_pubkey: string | null;
  client_seed: string | null;
  composed_seed: string | null;
  created_at: string;
};

export function useVrfTrace(game: string | null, roundRef: string | null) {
  const [trace, setTrace] = useState<VrfTrace | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!game || !roundRef) return;
    let live = true;
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from("apex_randomness_requests")
          .select("*")
          .eq("game", game)
          .eq("round_ref", roundRef)
          .maybeSingle();
        if (live) setTrace((data as VrfTrace) ?? null);
      } catch {
        if (live) setTrace(null);
      } finally {
        if (live) setLoading(false);
      }
    };
    load();
    const t = setInterval(load, 30_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [game, roundRef]);

  return { trace, loading };
}
