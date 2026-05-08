import { lazy, Suspense, useEffect, useRef, useState } from "react";

// Recharts is heavy — load only when section enters viewport.
const Charts = lazy(() => import("./TrustChartsInner"));

type HistoryRow = any;

export default function TrustHistoryCharts({ history, days }: { history: HistoryRow[]; days: 7 | 30 }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current || visible) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect(); } },
      { rootMargin: "200px" },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [visible]);

  return (
    <div ref={ref} className="grid md:grid-cols-2 gap-4 min-h-[200px]">
      {visible ? (
        <Suspense fallback={<ChartSkeleton count={2} />}>
          <Charts history={history} days={days} />
        </Suspense>
      ) : (
        <ChartSkeleton count={2} />
      )}
    </div>
  );
}

function ChartSkeleton({ count = 1 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass rounded-2xl p-3">
          <div className="h-3 w-32 rounded bg-muted/40 mb-3 animate-pulse" />
          <div className="h-[180px] rounded-lg bg-gradient-to-b from-muted/20 to-muted/5 relative overflow-hidden">
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-foreground/5 to-transparent animate-[shimmer_2s_infinite]" />
          </div>
        </div>
      ))}
    </>
  );
}
