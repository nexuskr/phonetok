// Lightweight Drand metadata helper for UI hover popovers.
// Full BLS verification is heavy; for chat we display round + signature head/tail.
export function drandSummary(round?: number | null, sig?: string | null) {
  if (!round || !sig) return { ok: false, label: "stamping…", url: "" };
  const head = sig.slice(0, 12);
  const tail = sig.slice(-12);
  return {
    ok: true,
    label: `round ${round.toLocaleString()} · ${head}…${tail}`,
    url: `https://api.drand.sh/52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971/public/${round}`,
  };
}
