/**
 * Lightweight analytics shim.
 *
 * Routing rules (intentional):
 *  - Each `track()` call is dispatched to AT MOST ONE provider per logical
 *    "channel" (vendor + product analytics + dev). This prevents a single
 *    user action from being double-counted when multiple SDKs are loaded.
 *  - Provider priority (first match wins):
 *      1. PostHog          — product analytics, owns user identity
 *      2. Plausible        — privacy-friendly page analytics
 *      3. gtag (GA4 / GTM) — generic fallback
 *      4. Umami            — privacy-friendly fallback
 *  - In dev (`import.meta.env.DEV`) we additionally `console.debug` the
 *    event for visibility, regardless of which provider received it.
 *  - Each event is also de-duplicated within a 250ms window keyed on
 *    `event + JSON(props)` to suppress React StrictMode double-invokes
 *    and accidental rapid re-clicks.
 *  - All errors are swallowed — analytics MUST NEVER break the app.
 */
type Props = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    plausible?: (event: string, opts?: { props?: Props }) => void;
    posthog?: { capture: (event: string, props?: Props) => void };
    umami?: { track: (event: string, props?: Props) => void };
    __phonaraAnalyticsLast?: Map<string, number>;
  }
}

const DEDUP_WINDOW_MS = 250;

function isRecentDuplicate(key: string): boolean {
  if (typeof window === "undefined") return false;
  const map = (window.__phonaraAnalyticsLast ??= new Map());
  const now = Date.now();
  const last = map.get(key) ?? 0;
  // GC small map opportunistically
  if (map.size > 50) {
    for (const [k, t] of map) if (now - t > 5000) map.delete(k);
  }
  if (now - last < DEDUP_WINDOW_MS) return true;
  map.set(key, now);
  return false;
}

export function track(event: string, props: Props = {}) {
  try {
    if (typeof window === "undefined") return;

    const key = event + "|" + JSON.stringify(props);
    if (isRecentDuplicate(key)) return;

    // First-match-wins routing — prevents double-counting across vendors.
    let dispatched: string | null = null;
    if (window.posthog?.capture) {
      window.posthog.capture(event, props);
      dispatched = "posthog";
    } else if (window.plausible) {
      window.plausible(event, { props });
      dispatched = "plausible";
    } else if (window.gtag) {
      window.gtag("event", event, props);
      dispatched = "gtag";
    } else if (window.umami?.track) {
      window.umami.track(event, props);
      dispatched = "umami";
    }

    if (import.meta.env.DEV) {
       
      console.debug("[analytics]", event, props, `→ ${dispatched ?? "noop"}`);
    }
  } catch {
    /* never throw from analytics */
  }
}
