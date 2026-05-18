/**
 * Sprint 4 — ClientMetricsBinder
 * Mount once at App root. Boots web-vitals + FPS sampler + edge-function flusher.
 * Zero render output; idle-callback boot to avoid critical-path cost.
 */
import { useEffect } from "react";
import { bootClientMetrics } from "@/packages/telemetry/clientMetrics";

export function ClientMetricsBinder() {
  useEffect(() => {
    const ric = (window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
    }).requestIdleCallback;
    if (typeof ric === "function") ric(() => bootClientMetrics(), { timeout: 4000 });
    else setTimeout(() => bootClientMetrics(), 2500);
  }, []);
  return null;
}

export default ClientMetricsBinder;
