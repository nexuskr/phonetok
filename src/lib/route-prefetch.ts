/**
 * Route prefetch — triggers lazy() chunk fetch ahead of navigation.
 *
 * Strategy:
 *  - On idle (after first paint): prefetch the most-likely next routes for
 *    authenticated dashboard users.
 *  - On hover/focus of a known link: prefetch that route immediately.
 *
 * Why: react-lazy + Suspense waits for the JS chunk on click; prefetching it
 * during idle time turns navigation into an instant transition.
 */

type Loader = () => Promise<unknown>;

const REGISTRY: Record<string, Loader> = {
  "/dashboard": () => import("@/pages/Dashboard.tsx"),
  "/wallet": () => import("@/pages/Wallet.tsx"),
  "/packages": () => import("@/pages/Packages.tsx"),
  "/missions": () => import("@/pages/Missions.tsx"),
  "/profile": () => import("@/pages/Profile.tsx"),
  "/empire": () => import("@/pages/Empire.tsx"),
  "/empire/hall": () => import("@/pages/EmpireHall.tsx"),
  "/empire/arena": () => import("@/pages/EmpireArena.tsx"),
  "/lounge": () => import("@/pages/Lounge.tsx"),
  "/trading": () => import("@/pages/TradingArenaWithArmy.tsx"),
  "/support": () => import("@/pages/Support.tsx"),
  "/guide": () => import("@/pages/Guide.tsx"),
  "/achievements": () => import("@/pages/Achievements.tsx"),
};

const fetched = new Set<string>();

export function prefetchRoute(path: string): void {
  if (fetched.has(path)) return;
  const loader = REGISTRY[path];
  if (!loader) return;
  fetched.add(path);
  // Fire and forget — errors will be retried on real navigation.
  loader().catch(() => fetched.delete(path));
}

/**
 * Schedule prefetch of the most likely next routes once the browser is idle.
 * Called once at app boot.
 */
export function schedulePrefetch(routes: string[] = ["/dashboard", "/wallet", "/packages", "/missions"]): void {
  if (typeof window === "undefined") return;
  const run = () => {
    for (const r of routes) prefetchRoute(r);
  };
  // @ts-ignore — requestIdleCallback may not exist in older browsers
  if (typeof window.requestIdleCallback === "function") {
    // @ts-ignore
    window.requestIdleCallback(run, { timeout: 4000 });
  } else {
    setTimeout(run, 1500);
  }
}

/** Attach onMouseEnter / onFocus prefetch to any element. */
export function prefetchHandlers(path: string) {
  return {
    onMouseEnter: () => prefetchRoute(path),
    onFocus: () => prefetchRoute(path),
    onTouchStart: () => prefetchRoute(path),
  };
}
