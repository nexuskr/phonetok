// 60s-poll marquee of recent whale strikes (public RPC).
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

type Strike = { nick?: string; kind?: string; amount_phon?: number; created_at?: string };

export default function LandingBigWinTicker() {
  const [items, setItems] = useState<Strike[]>([]);

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const { data } = await supabase.rpc("get_whale_strikes_24h", { _limit: 12 });
        if (live && Array.isArray(data)) setItems(data as Strike[]);
      } catch {
        /* silent */
      }
    };
    load();
    const t = setInterval(load, 60_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, []);

  if (items.length === 0) return null;
  const loop = [...items, ...items];

  return (
    <section
      aria-label="실시간 빅윈"
      className="mx-auto max-w-6xl overflow-hidden rounded-xl border border-border bg-card/60 px-2 py-3"
    >
      <motion.div
        className="flex gap-6 whitespace-nowrap"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
      >
        {loop.map((it, i) => (
          <span key={i} className="text-sm">
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-primary align-middle" />
            <span className="font-semibold text-foreground">{it.nick ?? "익명"}</span>
            <span className="mx-2 text-muted-foreground">·</span>
            <span className="text-primary">
              {Number(it.amount_phon ?? 0).toLocaleString()} PHON
            </span>
            <span className="mx-2 text-muted-foreground">{it.kind ?? ""}</span>
          </span>
        ))}
      </motion.div>
    </section>
  );
}
