// PR-P0-2 — useGlobalPolling
//
// PollingManager 의 React 어댑터. ref-count 기반이라 같은 key 를 여러 컴포넌트가
// 마운트해도 폴링 인스턴스는 하나만 도는 것을 보장한다.

import { useEffect, useRef } from "react";
import { PollingManager, type PollPriority, type PollCategory } from "@/lib/polling/PollingManager";

export type UseGlobalPollingOpts = {
  key: string;
  fn: () => void | Promise<void>;
  baseMs: number;
  enabled?: boolean;
  priority?: PollPriority;
  category?: PollCategory;
  leading?: boolean;
  owner?: string;
};

export function useGlobalPolling(opts: UseGlobalPollingOpts): { runNow: () => Promise<void> } {
  const { key, baseMs, enabled = true, priority, category, leading, owner } = opts;

  // fn 항상 최신
  const fnRef = useRef(opts.fn);
  fnRef.current = opts.fn;

  useEffect(() => {
    if (!enabled || baseMs <= 0) return;
    const unregister = PollingManager.register({
      key,
      fn: () => fnRef.current(),
      baseMs,
      priority,
      category,
      leading,
      owner,
    });
    return unregister;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, baseMs, enabled, priority, category, leading, owner]);

  return {
    runNow: () => PollingManager.runNow(key),
  };
}
