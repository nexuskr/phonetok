import { getFeed, type TickerStat } from "@/lib/paper-trading/bybit-feed";

/**
 * 단일 WS 구독을 useSyncExternalStore로 노출하는 가격 스토어.
 * 컴포넌트마다 useState 구독하던 패턴을 대체해 리렌더를 최소화.
 */
type Snapshot = {
  prices: Record<string, number>;
  stats: Record<string, TickerStat>;
  status: "connecting" | "open" | "reconnecting" | "rest-fallback";
  ts: number;
};

let snap: Snapshot = {
  prices: {},
  stats: {},
  status: "connecting",
  ts: 0,
};

const listeners = new Set<() => void>();
let started = false;

function emit() {
  snap = { ...snap, ts: Date.now() };
  listeners.forEach((l) => l());
}

function ensureStarted() {
  if (started) return;
  started = true;
  const feed = getFeed();
  feed.start();
  snap = {
    prices: feed.getPrices(),
    stats: feed.getStats(),
    status: "connecting",
    ts: Date.now(),
  };
  feed.onPrices((p) => { snap = { ...snap, prices: p }; emit(); });
  feed.onStats((s) => { snap = { ...snap, stats: s }; emit(); });
  feed.onStatus((s) => { snap = { ...snap, status: s }; emit(); });
}

export const priceStore = {
  subscribe(l: () => void) {
    ensureStarted();
    listeners.add(l);
    return () => { listeners.delete(l); };
  },
  getSnapshot(): Snapshot {
    ensureStarted();
    return snap;
  },
  getServerSnapshot(): Snapshot {
    return snap;
  },
};
