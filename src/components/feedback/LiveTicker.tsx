import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Flame, TrendingUp, Trophy } from "lucide-react";

type Item = { kind: string; title: string; amount: number; user_mask: string | null; flag?: string };

const SEED: Item[] = [
  { kind: "withdraw", title: "출금 완료", amount: 450000, user_mask: "김**", flag: "🇰🇷" },
  { kind: "mission", title: "미션 클리어", amount: 5000, user_mask: "이**", flag: "🇰🇷" },
  { kind: "trade", title: "롱 익절", amount: 230000, user_mask: "박**", flag: "🇰🇷" },
  { kind: "attendance", title: "30일 연속 출석", amount: 25000, user_mask: "최**", flag: "🇰🇷" },
  { kind: "referral", title: "친구 가입 보상", amount: 5000, user_mask: "정**", flag: "🇰🇷" },
  { kind: "slot", title: "Olympus 잭팟", amount: 1200000, user_mask: "한**", flag: "🇰🇷" },
];

function iconFor(kind: string) {
  if (kind === "withdraw" || kind === "trade") return TrendingUp;
  if (kind === "mission" || kind === "attendance") return Flame;
  return Trophy;
}

export default function LiveTicker() {
  const [items, setItems] = useState<Item[]>(SEED);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await supabase.rpc("get_live_activity_60s", { _limit: 20 });
        if (!cancelled && Array.isArray(data) && data.length >= 3) {
          setItems(data as unknown as Item[]);
        }
      } catch { /* keep seed */ }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // duplicate for seamless marquee
  const loop = [...items, ...items];

  return (
    <div className="overflow-hidden rounded-2xl border border-primary/15 bg-card/60 backdrop-blur py-2.5">
      <motion.div
        className="flex gap-6 whitespace-nowrap"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
      >
        {loop.map((it, i) => {
          const Icon = iconFor(it.kind);
          return (
            <div key={i} className="flex items-center gap-2 text-sm">
              <Icon className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">{it.flag ?? "🇰🇷"} {it.user_mask ?? "익명"}</span>
              <span className="font-semibold">{it.title}</span>
              <span className="text-primary font-bold">+{Number(it.amount).toLocaleString("ko-KR")} PHON</span>
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}
