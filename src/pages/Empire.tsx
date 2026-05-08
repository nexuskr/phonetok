import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/use-require-auth";
import EmpireFoundingCounter from "@/components/EmpireFoundingCounter";
import EmpireDayCountdown from "@/components/EmpireDayCountdown";
import { Crown, Trophy, Lock } from "lucide-react";
import { formatKRW } from "@/lib/store";
import { useTranslation } from "react-i18next";
import { LuxButton, Money } from "@/components/ui/lux";

type Founding = {
  id: string;
  founding_seat_no: number | null;
  total_settled: number;
  package_name: string;
};

export default function Empire() {
  const user = useRequireAuth();
  const nav = useNavigate();
  const { t } = useTranslation("empire");
  const [me, setMe] = useState<Founding | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      const { data: mine } = await supabase
        .from("package_purchases")
        .select("id,founding_seat_no,total_settled,package_name")
        .eq("user_id", user.id)
        .eq("is_empire_founding_member", true)
        .maybeSingle();
      if (!mounted) return;
      setMe((mine as Founding) ?? null);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [user]);

  if (!user) return null;

  return (
    <Layout>
      <div className="container pt-6 pb-10 animate-liquid-in">
        <div className="mb-6">
          <h1 className="font-imperial font-black text-2xl flex items-center gap-2 break-keep">
            <Crown className="w-6 h-6 text-gold" />
            <span className="text-gradient-gold">{t("title")}</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1 break-keep">{t("subtitle")}</p>
        </div>

        {loading ? null : !me ? (
          <div className="glass-strong rounded-3xl p-8 text-center neon-border">
            <Lock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <h2 className="font-imperial font-black text-lg mb-1 break-keep">{t("gateTitle")}</h2>
            <p className="text-xs text-muted-foreground mb-4 break-keep">{t("gateDesc")}</p>
            <div className="space-y-3 max-w-sm mx-auto">
              <EmpireFoundingCounter />
              <EmpireDayCountdown />
            </div>
            <LuxButton variant="gold" size="lg" block onClick={() => nav("/packages")} className="mt-5 max-w-sm mx-auto">
              <Crown className="w-4 h-4" /> {t("goPackages")}
            </LuxButton>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="glass-strong rounded-3xl p-6 neon-border relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-gold/30 blur-3xl" />
              <div className="relative">
                <div className="flex items-center gap-2 text-xs text-gold font-bold mb-1 tabular-nums">
                  <Crown className="w-4 h-4" /> {t("seat", { n: me.founding_seat_no })}
                </div>
                <h2 className="font-imperial font-black text-xl break-keep">{me.package_name}</h2>
                <p className="text-[11px] text-muted-foreground mt-1 break-keep">{t("foreverBadge")}</p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="glass rounded-xl p-3">
                    <div className="text-[10px] text-muted-foreground">{t("totalHarvest")}</div>
                    <Money strong className="font-display font-black text-base block">{formatKRW(me.total_settled)}</Money>
                  </div>
                  <div className="glass rounded-xl p-3 flex items-center justify-center">
                    <EmpireDayCountdown />
                  </div>
                </div>
              </div>
            </div>

            <EmpireFoundingCounter />

            <div className="glass rounded-2xl p-4">
              <div className="flex items-center gap-2 text-xs font-bold mb-3">
                <Trophy className="w-4 h-4 text-gold" /> {t("seatsTitle")}
              </div>
              <p className="text-[10px] text-muted-foreground break-keep">{t("seatsNote")}</p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
