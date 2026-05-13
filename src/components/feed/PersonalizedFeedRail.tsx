// V17 <PersonalizedFeedRail> — horizontal personalized feed.
// Loads recommendations from `rank_feed_for_user` RPC; if empty, asks the
// `feed-personalize` Edge function to build them, then re-loads.
import { useEffect, useState } from "react";
import { Sparkles, RefreshCw } from "lucide-react";
import { rankFeedForUser, type FeedRecommendation } from "@/lib/feed-rpc";
import { supabase } from "@/integrations/supabase/client";
import { LoadingList } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import FeedCard from "./FeedCard";

export default function PersonalizedFeedRail({ limit = 12 }: { limit?: number }) {
  const [items, setItems] = useState<FeedRecommendation[] | null>(null);
  const [generating, setGenerating] = useState(false);

  async function load() {
    try {
      const data = await rankFeedForUser(limit);
      setItems(data);
    } catch {
      setItems([]);
    }
  }

  async function generate() {
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const { notify } = await import("@/lib/notify");
        notify.info("로그인이 필요합니다", { description: "맞춤 피드를 생성하려면 먼저 로그인해 주세요." });
        return;
      }
      const { error } = await supabase.functions.invoke("feed-personalize", { body: {} });
      if (error) throw error;
      await load();
    } catch (e: any) {
      console.error("[PersonalizedFeedRail] generate failed", e);
      const { notify } = await import("@/lib/notify");
      notify.error("새로고침 실패", { description: e?.message ?? "잠시 후 다시 시도해 주세요." });
    } finally {
      setGenerating(false);
    }
  }

  // Initial load + auto-generate when empty (one shot)
  const [autoGenTried, setAutoGenTried] = useState(false);
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (items && items.length === 0 && !autoGenTried) {
      setAutoGenTried(true);
      void generate();
    }
  }, [items, autoGenTried]); // eslint-disable-line react-hooks/exhaustive-deps

  if (items == null) {
    return (
      <section className="space-y-3">
        <Header onRefresh={generate} busy={generating} />
        <LoadingList rows={1} />
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="space-y-3">
        <Header onRefresh={generate} busy={generating} />
        <EmptyState
          icon={<Sparkles className="w-5 h-5" />}
          title={generating ? "맞춤 피드를 생성하는 중…" : "곧 맞춤 피드가 준비됩니다"}
          description="당신의 등급·미션·시청 이력을 분석해 가장 어울리는 영상을 골라드립니다. 새로고침으로 즉시 생성할 수 있어요."
          variant="gold"
          size="sm"
        />
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <Header onRefresh={generate} busy={generating} />
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory">
        {items.map((it) => (
          <div key={it.video_id} className="snap-start">
            <FeedCard videoId={it.video_id} viralScore={(it as any).score ?? null} />
          </div>
        ))}
      </div>
    </section>
  );
}

function Header({ onRefresh, busy }: { onRefresh: () => void; busy: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-display font-black tracking-wide">For You</h2>
        <span className="text-[10px] tracking-widest text-muted-foreground uppercase hidden sm:inline">
          AI 큐레이션 · 등급/미션/시청 기반
        </span>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={busy}
        aria-label="피드 새로고침"
        className="text-xs font-bold text-muted-foreground hover:text-primary transition flex items-center gap-1 disabled:opacity-50"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${busy ? "animate-spin" : ""}`} /> 새로고침
      </button>
    </div>
  );
}
