/**
 * Lobby v3 — Emperor 시드 데이터.
 * 실제 사용자 presence 동기화는 Slice 3 로 분리. 현재는 공개 RPC `get_world_domination_stats`
 * 의 총 인구를 기반으로 시드 + 가짜 NPC 황제를 채워 사회적 증명 효과를 즉시 보여준다.
 * money-flow 8경로 미터치 — 읽기 전용 공개 RPC만 사용.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { LobbyEmperor } from "./types";

const EMOJIS = ["👑", "🦁", "🐉", "🦅", "🐺", "🐅", "🦊", "🐻", "🦌", "🦏"];
const PALETTE = [
  "#F5C518", "#FF8A3D", "#F472B6", "#A78BFA", "#60A5FA",
  "#34D399", "#FCD34D", "#FB7185", "#C084FC", "#7DD3FC",
];

function seedEmperors(count: number, seed: number): LobbyEmperor[] {
  const out: LobbyEmperor[] = [];
  for (let i = 0; i < count; i++) {
    const k = (seed + i * 9301 + 49297) % 233280;
    const r = k / 233280;
    const tier = Math.max(1, Math.min(10, Math.floor(r * 11)));
    out.push({
      id: `seed-${i}`,
      nickname: `황제#${(1000 + Math.floor(r * 9000)).toString()}`,
      tier,
      phon: Math.floor(500 + r * 50_000) * tier,
      color_hex: PALETTE[i % PALETTE.length],
      emoji: EMOJIS[i % EMOJIS.length],
      vip: tier >= 7 && (i % 5 === 0),
    });
  }
  return out;
}

export function useLobbyEmperors(target: number) {
  const [emperors, setEmperors] = useState<LobbyEmperor[]>(() => seedEmperors(target, 7));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.rpc("get_world_domination_stats" as never);
        if (cancelled) return;
        const d = (data as unknown as { total_emperors?: number }) || {};
        const live = d.total_emperors ?? target;
        setEmperors(seedEmperors(target, Math.max(1, live % 9999)));
      } catch {
        /* keep seed */
      }
    })();
    return () => { cancelled = true; };
  }, [target]);

  return emperors;
}
