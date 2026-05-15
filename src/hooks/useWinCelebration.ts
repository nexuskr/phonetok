// useWinCelebration — 슬롯 페이지에서 호출.
// (a) 매니저 상태 구독, (b) 트리거 헬퍼 반환, (c) 언마운트 시 안전 종료.
import { useCallback, useEffect, useState } from "react";
import {
  WinCelebrationManager,
  type CelebrationData,
} from "@/lib/celebration/WinCelebrationManager";
import type { WinTier } from "@/lib/sounds/soundConfig";

export function useWinCelebration(opts: { themeKey?: string; unitLabel?: string } = {}) {
  const [state, setState] = useState<CelebrationData | null>(WinCelebrationManager.getCurrent());

  useEffect(() => WinCelebrationManager.subscribe(setState), []);

  // 슬롯 페이지 언마운트 시 강제 종료
  useEffect(() => () => WinCelebrationManager.cancelCurrent(), []);

  const trigger = useCallback(
    (multiplier: number, totalWin: number): WinTier | null =>
      WinCelebrationManager.triggerWin(multiplier, totalWin, opts),
    [opts.themeKey, opts.unitLabel], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const dismiss = useCallback(() => WinCelebrationManager.endCurrent(), []);

  return { state, trigger, dismiss };
}

export default useWinCelebration;
