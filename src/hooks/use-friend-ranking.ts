import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FOMO_FRIEND_POLL_MS } from "@/lib/fomo";
import { useDocumentVisible } from "@/lib/util/visible-interval";
import { useGlobalPolling } from "@/hooks/polling/useGlobalPolling";

export type FriendRow = {
  user_id: string;
  nickname: string;
  weekly_phon: number;
  is_me: boolean;
  rnk: number;
};

export function useFriendRanking(limit = 5) {
  const [rows, setRows] = useState<FriendRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const visible = useDocumentVisible();

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const { data, error } = await supabase.rpc("get_my_friend_ranking" as any, { _limit: limit });
        if (!alive) return;
        if (error) { setRows(null); return; }
        setRows(((data as any[]) || []).map((r) => ({
          user_id: String(r.user_id),
          nickname: String(r.nickname ?? "황제***"),
          weekly_phon: Number(r.weekly_phon ?? 0),
          is_me: Boolean(r.is_me),
          rnk: Number(r.rnk ?? 0),
        })));
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    return () => { alive = false; };
  }, [limit, visible]);

  // PR-P0-2: 단일 PollingManager 사용 (ref-count, adaptive interval, backoff)
  useGlobalPolling({
    key: `friend-ranking:v2:${limit}`,
    fn: async () => {
      const { data, error } = await supabase.rpc("get_friend_weekly_ranking" as any, { _limit: limit });
      if (error) { setRows(null); return; }
      setRows(((data as any[]) || []).map((r) => ({
        user_id: String(r.user_id),
        nickname: String(r.nickname ?? "황제***"),
        weekly_phon: Number(r.weekly_phon ?? 0),
        is_me: Boolean(r.is_me),
        rnk: Number(r.rnk ?? 0),
      })));
    },
    baseMs: FOMO_FRIEND_POLL_MS,
    enabled: visible,
    priority: "cosmetic",
    category: "social",
    owner: "useFriendRanking",
  });

  return { rows, loading };
}

export type FriendGap = {
  direction: "ahead" | "behind" | "alone";
  gap_phon: number;
  other_nickname: string;
};

export function useFriendGap() {
  const [gap, setGap] = useState<FriendGap | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("get_my_friend_gap" as any);
        if (!alive || error) return;
        const row: any = Array.isArray(data) ? data[0] : data;
        if (!row) return;
        setGap({
          direction: (row.direction ?? "alone") as FriendGap["direction"],
          gap_phon: Number(row.gap_phon ?? 0),
          other_nickname: String(row.other_nickname ?? ""),
        });
      } catch {}
    })();
    return () => { alive = false; };
  }, []);
  return gap;
}
