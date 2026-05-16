import { lazy, Suspense, useEffect, useState } from "react";
import type { BigWinDetail } from "@/lib/bigwinShare";

const BigWinShareDialog = lazy(() => import("./BigWinShareDialog"));

/**
 * 전역 빅윈 공유 호스트.
 * `window.dispatchEvent(new CustomEvent('phonara:bigwin', { detail: { amount, symbol } }))` 만으로
 * 어디서든 자동 공유 다이얼로그를 띄울 수 있다.
 *
 * - 코드 스플릿: 다이얼로그 본체는 첫 이벤트가 발생할 때까지 로드하지 않음
 * - throttle: 5초 내 중복 이벤트는 무시
 */
export default function BigWinShareHost() {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<BigWinDetail | null>(null);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    let last = 0;
    const handler = (e: Event) => {
      const now = Date.now();
      if (now - last < 5000) return;
      last = now;
      const d = (e as CustomEvent<BigWinDetail>).detail;
      if (!d || typeof d.amount !== "number" || d.amount <= 0) return;
      setDetail(d);
      setArmed(true);
      setOpen(true);
    };
    window.addEventListener("phonara:bigwin", handler as EventListener);
    return () => window.removeEventListener("phonara:bigwin", handler as EventListener);
  }, []);

  if (!armed) return null;
  return (
    <Suspense fallback={null}>
      <BigWinShareDialog open={open} onClose={() => setOpen(false)} detail={detail} />
    </Suspense>
  );
}
