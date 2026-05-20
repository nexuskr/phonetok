// PR-P0-2 — Client-side cooperative rate guard
//
// 같은 endpoint 에 대해 짧은 시간 내 과도한 호출을 협조적으로 차단한다.
// 백엔드 RL 이 아직 없는 상태에서 클라가 스스로 자제하기 위함.
//
// 머니플로 8경로는 RL 금지 — 항상 통과.
// (반드시 호출돼야 하는 트랜잭션. 트리거/AAL2/idempotency 로 보호됨)

const MONEY_FLOW_DENY = new Set<string>([
  "request_withdrawal",
  "credit_crypto_deposit",
  "imperial_place_phon_bet",
  "imperial_settle_round",
  "imperial_settle_room",
  "swap_phon_to_phon",
  "swap_usdt_to_phon",
  "stake_phon",
  "unstake_phon",
  "claim_staking_reward",
]);

type Window = { times: number[]; backoffUntil: number; consecFails: number };
const windows = new Map<string, Window>();

const WINDOW_MS = 10_000; // 10s sliding window
const DEFAULT_LIMIT = 20; // 20 calls / 10s per endpoint

function getWin(key: string): Window {
  let w = windows.get(key);
  if (!w) {
    w = { times: [], backoffUntil: 0, consecFails: 0 };
    windows.set(key, w);
  }
  return w;
}

/**
 * @returns true if the call is allowed, false if it should be skipped.
 * Money flow endpoints always return true (never rate-limited client-side).
 */
export function rateGuardAllow(endpoint: string, limit: number = DEFAULT_LIMIT): boolean {
  if (MONEY_FLOW_DENY.has(endpoint)) return true;
  const now = Date.now();
  const w = getWin(endpoint);

  if (now < w.backoffUntil) return false;

  // prune
  w.times = w.times.filter((t) => now - t < WINDOW_MS);
  if (w.times.length >= limit) return false;
  w.times.push(now);
  return true;
}

/** 호출 실패 시 exp backoff (cap 30s) 적용. */
export function rateGuardFail(endpoint: string) {
  if (MONEY_FLOW_DENY.has(endpoint)) return;
  const w = getWin(endpoint);
  w.consecFails = Math.min(8, w.consecFails + 1);
  const base = 500 * Math.pow(2, w.consecFails - 1);
  const jitter = Math.random() * 250;
  w.backoffUntil = Date.now() + Math.min(30_000, base + jitter);
}

export function rateGuardOk(endpoint: string) {
  const w = windows.get(endpoint);
  if (w) w.consecFails = 0;
}

export function rateGuardSnapshot() {
  const now = Date.now();
  const entries: Array<{ endpoint: string; recent: number; backoffMs: number; fails: number }> = [];
  windows.forEach((w, k) => {
    entries.push({
      endpoint: k,
      recent: w.times.filter((t) => now - t < WINDOW_MS).length,
      backoffMs: Math.max(0, w.backoffUntil - now),
      fails: w.consecFails,
    });
  });
  return entries;
}
