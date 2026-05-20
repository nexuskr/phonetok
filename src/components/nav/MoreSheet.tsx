import { memo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Crown, Vault, Film, Activity,
  TrendingUp, Castle, Radio, ListChecks, User, Shield,
  type LucideIcon,
} from "lucide-react";
import BottomSheet from "@/components/ui/bottom-sheet";

interface Item {
  to: string;
  label: string;
  icon: LucideIcon;
  sub?: string;
  gold?: boolean;
}

const APEX_ITEMS: Item[] = [
  { to: "/apex/events/cup", label: "황제 컵",   icon: Crown,    sub: "주간 토너", gold: true },
  { to: "/apex/vault",      label: "일일 금고", icon: Vault,    sub: "매일 보상", gold: true },
  { to: "/apex/reels",      label: "윈 릴스",   icon: Film,     sub: "빅윈 릴",   gold: true },
  { to: "/apex/health",     label: "헬스",      icon: Activity, sub: "내 상태",   gold: true },
];

const GENERAL_ITEMS: Item[] = [
  { to: "/trade",            label: "트레이딩", icon: TrendingUp },
  { to: "/empire",           label: "황실",     icon: Castle },
  { to: "/live",             label: "라이브",   icon: Radio },
  { to: "/missions",         label: "미션",     icon: ListChecks },
  { to: "/profile",          label: "내정보",   icon: User },
  { to: "/security",         label: "보안",     icon: Shield },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function MoreSheetInner({ open, onOpenChange }: Props) {
  const nav = useNavigate();
  const go = useCallback(
    (to: string) => {
      onOpenChange(false);
      // micro-delay so sheet close animation feels responsive
      setTimeout(() => nav(to), 60);
    },
    [nav, onOpenChange],
  );

  const renderItem = (it: Item) => {
    const Icon = it.icon;
    return (
      <button
        key={it.to}
        type="button"
        onClick={() => go(it.to)}
        aria-label={it.label}
        className={[
          "flex flex-col items-center justify-center gap-1",
          "min-h-[72px] w-full rounded-2xl px-2 py-2",
          "transition-[transform,opacity] duration-[140ms] motion-reduce:transition-none",
          "active:opacity-75 active:scale-[0.97]",
          it.gold
            ? "bg-gradient-to-b from-amber-500/15 to-amber-400/5 ring-1 ring-amber-300/40"
            : "bg-card/40 ring-1 ring-border/40",
        ].join(" ")}
        style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
      >
        <Icon
          aria-hidden
          className={["w-[28px] h-[28px]", it.gold ? "text-amber-300" : "text-foreground"].join(" ")}
          strokeWidth={2.25}
        />
        <span className={["text-[16.5px] font-black leading-none", it.gold ? "text-amber-200" : "text-foreground"].join(" ")}>
          {it.label}
        </span>
        {it.sub && (
          <span className="text-[11px] leading-none text-muted-foreground">{it.sub}</span>
        )}
      </button>
    );
  };

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="더보기" maxHeight="78vh">
      <div className="px-4 pb-4 pt-1 space-y-4">
        <section>
          <div className="text-[11px] font-black tracking-[0.2em] text-amber-300/90 mb-2 pl-1">
            APEXFORGE
          </div>
          <div className="grid grid-cols-2 gap-3">
            {APEX_ITEMS.map(renderItem)}
          </div>
        </section>
        <section>
          <div className="text-[11px] font-black tracking-[0.2em] text-muted-foreground mb-2 pl-1">
            일반
          </div>
          <div className="grid grid-cols-2 gap-3">
            {GENERAL_ITEMS.map(renderItem)}
          </div>
        </section>
      </div>
    </BottomSheet>
  );
}

export const MoreSheet = memo(MoreSheetInner);
export default MoreSheet;
