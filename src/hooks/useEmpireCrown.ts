// useEmpireCrown — Legendary MAX Win 발동 시 award_crown RPC 자동 호출.
// BaseMaxWinOverlay.onMaxWinTriggered 의 payload 를 받아 idempotent 하게 처리한다.
// dedupeKey = `${slotId}:${startedAt}` 로 동일 셀러브레이션 중복 호출 차단.
import { useCallback, useRef } from "react";
import { awardCrown } from "@/lib/crown";
import { computeLegendaryCrown, resolveCrownWeight } from "@/lib/empireConfig";

export interface MaxWinPayload {
  multiplier: number;
  totalWin: number;
  slotId: string;
  themeKey?: string;
  startedAt: number;
}

export interface UseEmpireCrownReturn {
  /** BaseMaxWinOverlay 의 onMaxWinTriggered 에 그대로 전달. */
  handleMaxWinTriggered: (payload: MaxWinPayload) => void;
  /** Crown 가중치 — 디버그/표시용. */
  weight: number;
}

/** SlotSignatureWrapper 내부에서 1회 호출. slotId 변경 시 자동 재바인딩. */
export function useEmpireCrown(slotId: string): UseEmpireCrownReturn {
  // dedupe: 같은 startedAt 으로 두 번 호출되지 않도록 메모리 캐시
  const lastFired = useRef<number>(0);

  const handleMaxWinTriggered = useCallback(
    (payload: MaxWinPayload) => {
      if (!payload || !payload.slotId) return;
      if (payload.startedAt && payload.startedAt === lastFired.current) return;
      lastFired.current = payload.startedAt ?? Date.now();

      const base = computeLegendaryCrown(payload.slotId, payload.multiplier);
      const dedupeKey = `legendary:${payload.slotId}:${payload.startedAt ?? Date.now()}`;

      // Fire-and-forget — awardCrown 내부에서 rate_limit/duplicate/error 모두 silent 처리.
      void awardCrown("big_win", base, {
        dedupeKey,
        meta: {
          source: "max_win_overlay",
          slot_id: payload.slotId,
          theme: payload.themeKey ?? null,
          multiplier: Math.round(payload.multiplier),
          total_win: Math.round(payload.totalWin),
          weight: resolveCrownWeight(payload.slotId),
        },
      });
    },
    [slotId],
  );

  return {
    handleMaxWinTriggered,
    weight: resolveCrownWeight(slotId),
  };
}
