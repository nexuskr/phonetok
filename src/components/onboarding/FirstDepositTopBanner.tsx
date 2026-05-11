import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Flame, ArrowRight, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDB } from "@/lib/store";
import { track } from "@/lib/analytics";

const DISMISS_KEY = "first_deposit_banner_dismissed_until";

/**
 * Sticky top banner shown to logged-in users with 0 deposits.
 * - Dismissible for 24h
 * - Deeplinks to /wallet?tab=deposit&intent=first-deposit
 */
export default function FirstDepositTopBanner() {
  const [db] = useDB();
  const isLoggedIn = !!db.user?.id;
  const [hasDeposited, setHasDeposited] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const until = Number(localStorage.getItem(DISMISS_KEY) || "0");
      if (until && Date.now() < until) setDismissed(true);
    } catch {}
  }, []);

  useEffect(() => {
    if (!isLoggedIn) { setHasDeposited(null); return; }
    if ((db.deposits?.length ?? 0) > 0) { setHasDeposited(true); return; }
    let alive = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (alive) setHasDeposited(true); return; }
      const { count } = await supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("kind", "deposit");
      if (alive) setHasDeposited((count ?? 0) > 0);
    })();
    return () => { alive = false; };
  }, [isLoggedIn, db.deposits?.length]);

  // log impression once per session-shown
  const shown = isLoggedIn && hasDeposited === false && !dismissed;
  useEffect(() => {
    if (shown) track("first_deposit_banner_view", { surface: "dashboard_top" });
  }, [shown]);

  if (!shown) return null;

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now() + 24 * 3600_000)); } catch {}
    track("first_deposit_banner_dismiss", { surface: "dashboard_top" });
    setDismissed(true);
  }

  return (
    <div className="sticky top-0 z-30 -mx-3 sm:-mx-4 mb-3">
      <div className="mx-3 sm:mx-4 rounded-2xl border border-gold/50 bg-gradient-to-r from-gold/15 via-gold/8 to-transparent backdrop-blur px-3 py-2 flex items-center gap-2">
        <Flame className="w-4 h-4 text-gold shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-foreground leading-tight">
            첫 충전 시 <span className="text-gold">+30% 보너스</span> · 1버튼으로 시작
          </div>
          <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">
            오늘만 보너스 · 24시간 안에 출금까지 가능
          </div>
        </div>
        <Link
          to="/wallet?tab=deposit&intent=first-deposit"
          onClick={() => track("cta_click", { surface: "first_deposit_banner", action: "go_deposit" })}
          className="press sheen shrink-0 inline-flex items-center gap-1 min-h-[40px] px-3 rounded-xl bg-gradient-gold text-gold-foreground font-bold text-xs glow-gold"
        >
          시작 <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        <button
          onClick={dismiss}
          aria-label="닫기"
          className="shrink-0 min-w-[32px] min-h-[32px] flex items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
