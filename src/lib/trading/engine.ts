import { FEE_RATE, SLIPPAGE, type Side } from "./types";

export function applySlippage(side: Side, mark: number, opening: boolean): number {
  // Opening: pay worse price. Closing: receive worse price.
  const sign = (opening ? (side === "long" ? +1 : -1) : (side === "long" ? -1 : +1));
  return mark * (1 + sign * SLIPPAGE);
}

export function computeSize(margin: number, leverage: number, entry: number) {
  if (entry <= 0) return 0;
  return (margin * leverage) / entry;
}

export function computePnl(side: Side, entry: number, exit: number, size: number) {
  const dir = side === "long" ? 1 : -1;
  return (exit - entry) * size * dir;
}

export function computeRoi(side: Side, entry: number, mark: number, leverage: number) {
  const change = (mark - entry) / entry;
  return (side === "long" ? change : -change) * leverage;
}

export function liquidationPrice(side: Side, entry: number, leverage: number) {
  if (leverage <= 0) return 0;
  const drop = entry / leverage;
  return side === "long" ? Math.max(0, entry - drop) : entry + drop;
}

export function openFee(margin: number, leverage: number) {
  return Math.floor(margin * leverage * FEE_RATE);
}

export function closeFee(exit: number, size: number) {
  return Math.floor(exit * size * FEE_RATE);
}

/** Distance to liquidation as % of margin. <0 means already past. */
export function liquidationProgress(side: Side, entry: number, mark: number, leverage: number) {
  const roi = computeRoi(side, entry, mark, leverage);
  // 0 = entry, 1 = liquidated
  return Math.min(1, Math.max(0, -roi));
}
