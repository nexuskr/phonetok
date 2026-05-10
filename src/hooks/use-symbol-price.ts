import { useSyncExternalStore } from "react";
import { getFeed, type TickerStat } from "@/lib/paper-trading/bybit-feed";

/**
 * Fine-grained selector: re-renders ONLY when the given symbol's price changes.
 * Ideal for chart, order panel, and any single-symbol UI.
 */
export function useSymbolPrice(symbol: string): number {
  const feed = getFeed();
  const subscribe = (cb: () => void) => feed.onSymbolPrice(symbol, cb);
  const getSnapshot = () => feed.getPrices()[symbol] ?? 0;
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

const EMPTY_STAT: TickerStat = {
  last: 0, change24hPct: 0, volume24h: 0, turnover24h: 0, high24h: 0, low24h: 0,
  fundingRate: 0, nextFundingTime: 0,
};

export function useSymbolStat(symbol: string): TickerStat {
  const feed = getFeed();
  const subscribe = (cb: () => void) => feed.onSymbolStat(symbol, cb);
  const getSnapshot = () => feed.getStats()[symbol] ?? EMPTY_STAT;
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
