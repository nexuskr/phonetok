/**
 * @pkg/runtime/runtime.lattice — owner/category inference (DEV only)
 *
 * Pure functions. No side effects. Used by runtime.observe to classify
 * a captured legacy setInterval call from its stack trace.
 *
 * Rules:
 *  - Conservative defaults: unknown beats wrong-category.
 *  - Money-flow paths MUST be classified as "money_flow" so they show up
 *    as FREEZE in the ledger.
 */
import type { RuntimeCategory } from "./runtime.registry";

const MONEY_FLOW_PREFIXES = [
  "src/packages/wallet/",
  "src/lib/paper-trading/",
  "src/lib/trading/",
  "src/components/crash/",
  "src/components/trading/MegaOrderPanel",
  "src/hooks/use-kill-switches",
  "src/hooks/use-auto-bet",
  "src/hooks/use-wallet",
  "src/lib/withdrawal/",
];

const ADMIN_PREFIXES = [
  "src/pages/admin/",
  "src/components/admin/",
  "src/packages/operator/",
];

const COSMETIC_HINTS = [
  "Ticker",
  "Marquee",
  "Countdown",
  "Pulse",
  "Wall",
  "Banner",
  "FX",
  "Strip",
  "Rail",
  "Story",
  "FomoNotification",
  "Celebration",
  "Onboarding",
  "Journey",
  "LiveStats",
  "LiveCounter",
  "Attendance",
  "Boost",
  "SocialProof",
  "Tournament",
  "Sound",
];

/** Parse a stack frame for a project source path. */
function pickFrame(stack: string | undefined): string | null {
  if (!stack) return null;
  const lines = stack.split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    // Skip the registry/observe frames themselves
    if (line.includes("runtime.registry") || line.includes("runtime.observe") || line.includes("runtime.lattice")) continue;
    if (line.includes("entropy.capture") || line.includes("visible-interval")) continue;
    // Look for /src/... path
    const m = line.match(/\/(src\/[^\s)?:]+)/);
    if (m) return m[1];
  }
  return null;
}

export function inferCategoryFromStack(stack: string | undefined): RuntimeCategory {
  const frame = pickFrame(stack);
  if (!frame) return "unknown";
  for (const p of MONEY_FLOW_PREFIXES) if (frame.startsWith(p)) return "money_flow";
  for (const p of ADMIN_PREFIXES)      if (frame.startsWith(p)) return "admin";
  for (const h of COSMETIC_HINTS)      if (frame.includes(h)) return "cosmetic";
  return "unknown";
}

export function inferOwnerFromStack(stack: string | undefined): string {
  const frame = pickFrame(stack);
  if (!frame) return "legacy";
  // strip query/hash, take last 2 segments for readability
  const clean = frame.replace(/\?.*$/, "");
  const parts = clean.split("/");
  return parts.slice(-2).join("/");
}
