/**
 * rpc.surface — DEV-only RPC 3-mode collector.
 *
 * PR-F (Phase 2 Visibility): install lightweight fetch/XHR instrumentation that
 * classifies REST/RPC calls into foreground / hidden / idle buckets. Observation
 * ONLY — no payload mutation, no behavior change, no timing change.
 *
 * Production builds: tree-shaken via import.meta.env.DEV guard at call sites.
 *
 * Usage:
 *   import { installRpcSurface } from "@/packages/entropy/rpc.surface";
 *   if (import.meta.env.DEV) installRpcSurface();
 *
 * Then in DevTools:
 *   window.__phonaraSurface.report()    // print 3-mode JSON
 *   window.__phonaraSurface.entropy()   // print entropy ledger
 */

type Bucket = { count: number; byRpc: Record<string, number> };
type Surface = {
  startedAt: string;
  foreground: Bucket;
  hidden: Bucket;
  idle: Bucket;
};

declare global {
  interface Window {
    __phonaraSurface?: {
      report: () => unknown;
      entropy: () => unknown;
      reset: () => void;
    };
    __entropyExport?: () => unknown;
  }
}

const IDLE_MS = 60_000;

let installed = false;

export function installRpcSurface() {
  if (typeof window === "undefined" || installed) return;
  installed = true;

  const surface: Surface = {
    startedAt: new Date().toISOString(),
    foreground: { count: 0, byRpc: {} },
    hidden: { count: 0, byRpc: {} },
    idle: { count: 0, byRpc: {} },
  };

  let mode: "foreground" | "hidden" | "idle" = document.hidden ? "hidden" : "foreground";
  let lastInteraction = Date.now();

  document.addEventListener("visibilitychange", () => {
    mode = document.hidden ? "hidden" : "foreground";
  });
  (["pointerdown", "keydown", "scroll", "touchstart"] as const).forEach((ev) =>
    window.addEventListener(ev, () => { lastInteraction = Date.now(); }, { passive: true })
  );
  // 1s tick to flip into idle when foreground but no input for IDLE_MS.
  setInterval(() => {
    if (!document.hidden && Date.now() - lastInteraction > IDLE_MS) mode = "idle";
  }, 1000);

  function bump(url: string) {
    try {
      const m = url.match(/\/rest\/v1\/rpc\/([A-Za-z0-9_-]+)/);
      const key = m ? m[1] : (url.match(/\/rest\/v1\/([A-Za-z0-9_-]+)/)?.[1] ?? "non-rpc");
      const bucket = surface[mode];
      bucket.count += 1;
      bucket.byRpc[key] = (bucket.byRpc[key] || 0) + 1;
    } catch { /* noop */ }
  }

  // fetch instrumentation
  const nativeFetch = window.fetch.bind(window);
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === "string" ? input : (input instanceof URL ? input.href : input.url);
    if (url.includes("/rest/v1/")) bump(url);
    return nativeFetch(input as RequestInfo, init);
  };

  // XHR instrumentation
  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: unknown[]) {
    const u = typeof url === "string" ? url : url.href;
    if (u.includes("/rest/v1/")) bump(u);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (origOpen as any).call(this, method, url, ...rest);
  };

  window.__phonaraSurface = {
    report() {
      const payload = { ...surface, capturedAt: new Date().toISOString(), currentMode: mode };
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(payload, null, 2));
      return payload;
    },
    entropy() {
      const fn = window.__entropyExport;
      const r = typeof fn === "function" ? fn() : null;
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(r, null, 2));
      return r;
    },
    reset() {
      surface.startedAt = new Date().toISOString();
      surface.foreground = { count: 0, byRpc: {} };
      surface.hidden = { count: 0, byRpc: {} };
      surface.idle = { count: 0, byRpc: {} };
    },
  };

  // eslint-disable-next-line no-console
  console.info("[rpc.surface] installed (DEV). After scenario, run __phonaraSurface.report().");
}
