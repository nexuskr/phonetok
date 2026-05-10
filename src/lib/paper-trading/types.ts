export type Side = "long" | "short";

export interface Position {
  id: string;
  symbol: string;
  side: Side;
  leverage: number;   // 1..100
  margin: number;     // USDT (paper)
  entry: number;
  openedAt: number;
  closed?: {
    price: number;
    at: number;
    pnl: number;
    roi: number;
    reason: "manual" | "liquidation";
  };
}

export const SYMBOLS = [
  "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT",
  "DOGEUSDT", "ADAUSDT", "AVAXUSDT", "LINKUSDT", "MATICUSDT",
  "DOTUSDT", "TRXUSDT", "LTCUSDT", "NEARUSDT", "ATOMUSDT",
  "APTUSDT", "SUIUSDT", "ARBUSDT", "OPUSDT", "INJUSDT",
  "PEPEUSDT", "SHIB1000USDT", "WIFUSDT", "BONKUSDT", "FLOKIUSDT",
] as const;

export type Symbol = typeof SYMBOLS[number];
