import { Link } from "react-router-dom";
import { X, Crown, Users, Phone, Sparkles, Check, Lock } from "lucide-react";
import { formatKRW } from "@/lib/store";
import { track } from "@/lib/analytics";
import { useTrackView, trackClick, trackDismiss } from "@/lib/telemetry";
import { useTranslation } from "react-i18next";

export default function UnlockWall({
  amount,
  onClose,
}: {
  amount: number;
  onClose: () => void;
}) {
  const { t } = useTranslation("convert");
  useTrackView("unlock_wall", "v1", { amount });
  return (
    <div className="fixed inset-0 z-[75] bg-background/90 backdrop-blur-xl flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md glass-strong rounded-3xl p-6 neon-border relative overflow-hidden animate-fade-up">
        <button
          onClick={() => { void trackDismiss("unlock_wall", "v1", { amount }); onClose(); }}
          className="absolute top-3 right-3 min-h-[44px] min-w-[44px] rounded-full bg-muted/40 flex items-center justify-center"
          aria-label={t("close")}
        >
          <X className="w-4 h-4" />
        </button>
        <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-gradient-gold blur-3xl opacity-30" />

        <div className="relative">
          <div className="flex items-center gap-2 text-[10px] tracking-[0.3em] text-secondary font-black">
            <Lock className="w-3 h-3" /> {t("step1")}
          </div>
          <h2 className="font-imperial text-xl text-gradient-imperial mt-1 break-keep">
            {t("lastStep")}
          </h2>
          <p className="text-[11px] text-muted-foreground mt-1 break-keep">
            {t("requestAmt")} <span className="font-bold text-foreground tabular-nums">{formatKRW(amount)}</span>
          </p>

          <Link
            to="/packages"
            onClick={() => { track("unlock_wall_path_a_click"); void trackClick("unlock_wall", "path_a", { amount }); }}
            className="press relative mt-4 block glass-strong rounded-2xl p-4 border-2 border-gold/60 overflow-hidden min-h-[56px]"
          >
            <span className="absolute top-2 right-2 text-[9px] font-black px-2 py-0.5 rounded-full bg-gradient-gold text-gold-foreground">
              {t("pathARecommended")}
            </span>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-gold flex items-center justify-center glow-imperial shrink-0">
                <Crown className="w-5 h-5 text-gold-foreground" />
              </div>
              <div className="flex-1">
                <div className="font-display font-black text-sm">{t("pathATitle")}</div>
                <div className="text-[10px] text-muted-foreground break-keep">
                  {t("pathADesc")}
                </div>
              </div>
              <Sparkles className="w-4 h-4 text-gold" />
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[10px] flex-wrap">
              <Check className="w-3 h-3 text-secondary" />
              <span className="text-secondary font-bold">{t("pathAOk")}</span>
              <span className="text-muted-foreground">{t("pathAFee")}</span>
            </div>
          </Link>

          <Link
            to="/profile"
            onClick={() => { track("unlock_wall_path_b_click"); void trackClick("unlock_wall", "path_b", { amount }); }}
            className="press relative mt-3 block glass rounded-2xl p-3 border border-border/40 min-h-[56px]"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-secondary/20 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-secondary" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-xs">{t("pathBTitle")}</div>
                <div className="text-[10px] text-muted-foreground break-keep">
                  {t("pathBDesc")}
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground">{t("pathBEta")}</span>
            </div>
          </Link>

          <button
            onClick={() => {
              track("unlock_wall_path_c_click");
              void trackClick("unlock_wall", "path_c", { amount });
              onClose();
            }}
            className="press relative mt-2 block w-full glass rounded-2xl p-3 border border-border/30 opacity-70 text-left min-h-[56px]"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-muted/40 flex items-center justify-center shrink-0">
                <Phone className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-xs">{t("pathCTitle")}</div>
                <div className="text-[10px] text-muted-foreground break-keep">
                  {t("pathCDesc")}
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground">{t("pathCEta")}</span>
            </div>
          </button>

          <p className="mt-4 text-[10px] text-center text-muted-foreground break-keep">
            {t("footnote")}
          </p>
        </div>
      </div>
    </div>
  );
}
