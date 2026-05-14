/**
 * VipArrivalAnnouncer — fires log_vip_arrival once per session for VIP holders.
 * Mounts in App root; no UI of its own. Server-side enforces vip_only + 60s dedupe.
 */
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useVipPass } from "@/hooks/use-vip-pass";

export default function VipArrivalAnnouncer() {
  const vip = useVipPass();
  const fired = useRef(false);

  useEffect(() => {
    if (vip.loading || !vip.active || fired.current) return;
    fired.current = true;
    (async () => {
      try {
        await supabase.rpc("log_vip_arrival");
      } catch {
        /* non-fatal */
      }
    })();
  }, [vip.loading, vip.active]);

  return null;
}
