/**
 * <ApexBigWinShareListener /> — global listener that opens ApexShareSheet
 * when useApexGame emits a `apex:bigwin` CustomEvent.
 */
import { useEffect, useState } from "react";
import { ApexShareSheet, shouldAutoShare, type ApexShareResult } from "./ApexShareSheet";

export function ApexBigWinShareListener() {
  const [result, setResult] = useState<ApexShareResult | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ApexShareResult>).detail;
      if (!detail) return;
      if (!shouldAutoShare({
        rollId: detail.rollId,
        multiplier: detail.multiplier,
        payoutPhonEq: detail.payoutPhonEq,
      })) return;
      setResult(detail);
      setOpen(true);
    };
    window.addEventListener("apex:bigwin", handler as EventListener);
    return () => window.removeEventListener("apex:bigwin", handler as EventListener);
  }, []);

  return <ApexShareSheet open={open} result={result} onClose={() => setOpen(false)} />;
}
