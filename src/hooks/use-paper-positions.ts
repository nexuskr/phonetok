import { useEffect, useRef } from "react";
import { usePaperStore } from "@/lib/paper-trading/store";
import { useBybitTicker } from "./use-bybit-ticker";
import { notify } from "@/lib/notify";
import { track } from "@/lib/telemetry";

/** Drives liquidation tick + paper_trade liquidation telemetry. */
export function usePaperLiquidationWatcher() {
  const { prices } = useBybitTicker();
  const tick = usePaperStore((s) => s.tick);
  const hasPositions = usePaperStore((s) => s.positions.length > 0);
  const lastRef = useRef<number>(0);

  useEffect(() => {
    if (!hasPositions) return;
    const now = Date.now();
    if (now - lastRef.current < 800) return;
    lastRef.current = now;
    const liq = tick(prices);
    for (const p of liq) {
      const pnlUsdt = Number(p.closed?.pnl ?? 0);
      // approximate PHON for threshold routing (1 USDT ≈ 1300 PHON)
      const pnlPhonApprox = pnlUsdt * 1300;
      notify.result({
        kind: "liq",
        amountPhon: pnlPhonApprox,
        title: `청산 · ${p.symbol} ${p.side.toUpperCase()} ${p.leverage}x`,
        description: `손실 ${pnlUsdt.toFixed(2)} USDT`,
      });
      track("convert", {
        surface: "paper_trade",
        variant: "liquidation",
        meta: {
          symbol: p.symbol, side: p.side, leverage: p.leverage,
          margin: p.margin, pnl: p.closed?.pnl, roi: p.closed?.roi,
        },
      });
    }
  }, [prices, tick, hasPositions]);
}
