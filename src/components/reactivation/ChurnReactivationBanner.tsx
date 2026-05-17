import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Offer {
  send_id: string;
  campaign_key: string;
  title: string;
  cta_label: string;
  phon_bonus: number;
}

/**
 * ChurnReactivationBanner — Dashboard 상단 상시 슬림 배너.
 * `ReactivationOfferDialog` 와 공존하며, 다이얼로그를 닫아도 계속 노출.
 */
export default function ChurnReactivationBanner() {
  const [offer, setOffer] = useState<Offer | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase.rpc("get_my_reactivation_offer" as any);
        if (!alive) return;
        const row = Array.isArray(data) ? data[0] : data;
        if (row) setOffer(row as Offer);
      } catch {}
    })();
    return () => { alive = false; };
  }, []);

  if (!offer) return null;

  return (
    <Link
      to="/wallet"
      className="block rounded-xl border border-amber-400/40 bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-amber-500/10 px-4 py-3 hover:border-amber-400/70 transition press"
    >
      <div className="flex items-center gap-3">
        <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-foreground truncate">{offer.title}</div>
          <div className="text-[11px] text-muted-foreground">
            폐하의 자리는 그대로입니다 · 복귀 보너스 +{Number(offer.phon_bonus).toLocaleString()} PHON
          </div>
        </div>
        <span className="text-xs font-black text-amber-300 hidden sm:inline">{offer.cta_label}</span>
        <ChevronRight className="w-4 h-4 text-amber-300" />
      </div>
    </Link>
  );
}
