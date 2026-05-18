import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Swords, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Phase 4 P1 Hyperion — surfaced inside ImperialWelcomeDialog step 3.
 * Logs `onboarding.first_duel` observability event when CTA fires.
 */
export default function FirstDuelInvite({ onGo }: { onGo: () => void }) {
  const navigate = useNavigate();

  const go = async () => {
    try {
      await (supabase as any).rpc("imperial_log_observability", {
        _kind: "onboarding.first_duel",
        _payload: { from: "welcome_dialog" },
      });
    } catch {}
    onGo();
    navigate("/duel?from=onboarding");
  };

  return (
    <button
      onClick={go}
      className="group relative w-full overflow-hidden rounded-xl border border-amber-400/40 bg-gradient-to-br from-amber-950/30 via-background to-amber-900/20 p-4 text-left transition-all hover:border-amber-300/70 hover:shadow-[0_0_24px_-4px_hsl(45_90%_55%/0.45)]"
    >
      <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-amber-400/15 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-500/20 ring-1 ring-amber-300/50">
          <Swords className="h-5 w-5 text-amber-300" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1.5 text-sm font-bold">
            첫 Duel 입장 <Sparkles className="h-3.5 w-3.5 text-amber-300" />
          </div>
          <div className="text-xs text-muted-foreground">30초 안에 첫 승부 · Observer Mode 안전</div>
        </div>
        <Button size="sm" className="bg-amber-500 text-amber-950 hover:bg-amber-400">
          입장
        </Button>
      </div>
    </button>
  );
}
