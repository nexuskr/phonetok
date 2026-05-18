// IMPERIAL PHASE 4 — Circuit Breaker v2 (3-state, exponential backoff, jitter).
// Inert-by-default: opens only after sustained failures. Designed to wrap RPC calls
// without touching money-flow code. Per-key state lives in sessionStorage.

export type CircuitState = "closed" | "open" | "half_open";

interface Entry {
  state: CircuitState;
  failures: number;
  openedAt: number;
  nextProbeAt: number;
}

const REGISTRY = new Map<string, Entry>();
const SS_PREFIX = "imperial:cb:v2:";
const BASE_MS = 1500;
const MAX_MS = 60_000;
const FAIL_THRESHOLD = 5;

function load(key: string): Entry {
  const cached = REGISTRY.get(key);
  if (cached) return cached;
  try {
    const raw = sessionStorage.getItem(SS_PREFIX + key);
    if (raw) {
      const parsed = JSON.parse(raw) as Entry;
      REGISTRY.set(key, parsed);
      return parsed;
    }
  } catch { /* noop */ }
  const fresh: Entry = { state: "closed", failures: 0, openedAt: 0, nextProbeAt: 0 };
  REGISTRY.set(key, fresh);
  return fresh;
}

function persist(key: string, entry: Entry) {
  REGISTRY.set(key, entry);
  try { sessionStorage.setItem(SS_PREFIX + key, JSON.stringify(entry)); } catch { /* noop */ }
}

function jitter(ms: number): number {
  return ms * (0.7 + Math.random() * 0.6);
}

export function canAttempt(key: string): boolean {
  const e = load(key);
  if (e.state === "closed") return true;
  if (e.state === "open") {
    if (Date.now() >= e.nextProbeAt) {
      persist(key, { ...e, state: "half_open" });
      return true;
    }
    return false;
  }
  return true; // half_open allows one probe
}

export function recordSuccess(key: string) {
  persist(key, { state: "closed", failures: 0, openedAt: 0, nextProbeAt: 0 });
}

export function recordFailure(key: string) {
  const e = load(key);
  const failures = e.failures + 1;
  if (failures >= FAIL_THRESHOLD || e.state === "half_open") {
    const backoff = Math.min(MAX_MS, BASE_MS * Math.pow(2, Math.min(failures, 8)));
    persist(key, {
      state: "open",
      failures,
      openedAt: Date.now(),
      nextProbeAt: Date.now() + jitter(backoff),
    });
  } else {
    persist(key, { ...e, failures });
  }
}

export function inspect(key: string): Entry {
  return { ...load(key) };
}

export function reset(key: string) {
  REGISTRY.delete(key);
  try { sessionStorage.removeItem(SS_PREFIX + key); } catch { /* noop */ }
}

export async function withCircuit<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (!canAttempt(key)) throw new Error(`circuit_open:${key}`);
  try {
    const out = await fn();
    recordSuccess(key);
    return out;
  } catch (err) {
    recordFailure(key);
    throw err;
  }
}
