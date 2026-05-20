# Polling Manager (PR-P0-2)

## 목적

모든 클라이언트 cosmetic/social polling 을 단일 싱글톤(`PollingManager`) 으로 통합 관리.
- 우선순위 큐 (critical/high/normal/low/cosmetic)
- adaptive interval (`base × activityMul × deviceMul × backoffMul`)
- 동시 in-flight 캡 (≤4) → 폭주 방지
- 백그라운드 탭 / governor 차단 자동 적용 (`setVisibleInterval` 위에 동작)
- DEV ledger 호환 (Phase 2 Visibility ledger 그대로)

## 사용

```ts
import { useGlobalPolling } from "@/hooks/polling/useGlobalPolling";

useGlobalPolling({
  key: "phon-traders-24h",     // 안정 고유 키 (ref-count)
  fn: load,                    // async OK
  baseMs: 60_000,
  priority: "cosmetic",
  category: "social",
  leading: true,
  owner: "PhonHub:Traders24h",
});
```

## 금지

- `category: "money_flow"` 등록 시 **`MoneyFlowDenyError` throw** (fail-closed)
- 머니플로 8경로 RPC 는 절대 PollingManager 로 호출하지 말 것
- `setInterval` 직접 호출은 deprecated — `useGlobalPolling` 또는 `setVisibleInterval` 사용

## Adaptive 공식

| Factor | 조건 | Multiplier |
|---|---|---|
| activityMul | idle > 60s | 1.5x |
| activityMul | idle > 5min | 3x |
| deviceMul | saveData | 2x |
| deviceMul | 2g | 3x |
| deviceMul | 3g / 저메모리 | 1.5x |
| backoffMul | 실패 시 exp(cap 8x) | 1.5~8x |
| backoffMul | 성공 시 회복 | × 0.7 |

## Rate Guard

`src/lib/api/rateGuard.ts` — 같은 endpoint 10s 윈도우 ≥ 20 호출 시 협조적 거절 +
실패 시 exp backoff (cap 30s).
**머니플로 8경로는 항상 통과** (`MONEY_FLOW_DENY` allowlist).

## 모니터링

`<PollingStatusCard />` — 운영자 Health Dock 에 마운트.
DEV: `window.__pollingManager.snapshot()`.

## 예상 효과 (전체 마이그레이션 후)

| 시나리오 | Before | After |
|---|---|---|
| 백그라운드 탭 10분 | ~600 calls | 0 |
| idle 10분 (foreground) | ~60/min | 12~18/min (70%↓) |
| 활성 사용 | ~60/min | ~50/min (concurrency cap) |
