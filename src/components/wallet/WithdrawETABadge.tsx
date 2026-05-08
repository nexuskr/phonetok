import { Clock, Crown, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Props {
  tier: string;
  amount: number;
}

/**
 * Estimated approval time based on tier + amount band.
 * Pure UI hint — actual SLA is governed server-side.
 */
export default function WithdrawETABadge({ tier, amount }: Props) {
  const { i18n } = useTranslation();
  const en = (i18n.language || "ko").startsWith("en");

  const eta = computeETA(tier, amount);
  const Icon = eta.icon;

  return (
    <div className={`flex items-center gap-3 rounded-xl p-3.5 border ${eta.tone}`}>
      <Icon className="w-5 h-5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] tracking-[0.2em] font-bold uppercase opacity-80">
          {en ? "Estimated approval" : "예상 승인 시간"}
        </div>
        <div className="text-sm font-black mt-0.5">{en ? eta.labelEn : eta.label}</div>
        <div className="text-[10px] opacity-70 mt-0.5">{en ? eta.noteEn : eta.note}</div>
      </div>
    </div>
  );
}

function computeETA(tier: string, amount: number) {
  const t = (tier || "").toLowerCase();
  const isVIP = t === "vip" || t === "emperor" || t === "diamond" || t === "platinum";
  const isPro = t === "gold" || t === "premium" || t === "pro";
  const huge = amount >= 5_000_000;
  const large = amount >= 1_000_000;

  if (isVIP && !huge) {
    return {
      icon: Crown,
      tone: "border-primary/60 bg-gradient-imperial/10 text-foreground",
      label: "5분 ~ 30분",
      labelEn: "5 – 30 min",
      note: "VIP 우선 처리 채널",
      noteEn: "VIP priority queue",
    };
  }
  if (isPro && !huge) {
    return {
      icon: Zap,
      tone: "border-primary/40 bg-primary/[0.06] text-foreground",
      label: large ? "30분 ~ 2시간" : "10분 ~ 60분",
      labelEn: large ? "30 min – 2 h" : "10 – 60 min",
      note: "Pro 우선 처리",
      noteEn: "Pro priority",
    };
  }
  if (huge) {
    return {
      icon: Clock,
      tone: "border-amber-500/40 bg-amber-500/10 text-foreground",
      label: "2시간 ~ 24시간",
      labelEn: "2 – 24 h",
      note: "고액은 추가 검토가 필요할 수 있음",
      noteEn: "Large amounts may need extra review",
    };
  }
  return {
    icon: Clock,
    tone: "border-border/40 bg-muted/20 text-foreground",
    label: large ? "1시간 ~ 4시간" : "30분 ~ 2시간",
    labelEn: large ? "1 – 4 h" : "30 min – 2 h",
    note: "표준 처리 시간",
    noteEn: "Standard processing window",
  };
}
