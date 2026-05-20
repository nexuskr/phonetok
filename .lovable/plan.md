# P0-7 — 결제/입금 흐름 안정화

## 목표

입금/결제 흐름의 race condition · idempotency · 다중 탭 동기화 · 모니터링 폴링을 철벽으로 안정화. 머니플로 8경로 RPC 본문 git diff = 0, RPC wrapper만 사용.

## 현재 상태 (조사 결과)

- `src/packages/wallet/hooks/useDeposit.ts` — coin/bank/voucher 오케스트레이션. **머니플로 FREEZE 파일**, 본문 미변경.
- `src/packages/wallet/hooks/useDepositRealtime.ts` — single-intent UPDATE 구독. FREEZE 파일.
- 모니터링 폴링: `useDeposit.ts` 내부 `setInterval(pollPending, 30_000)` — PollingManager 비연동 (백그라운드/idle 가드 약함).
- `src/components/empire/PhonaraPayPanel.tsx` — `supabase.channel(...)` raw 구독 + 다중 탭 dedup 없음 + 모든 UPDATE 수신.
- `src/hooks/deposit/*`, `src/lib/deposit/*` 없음.
- idempotency: `clientReqIdRef = crypto.randomUUID()` 한번 — localStorage 캐시/재진입 가드 없음.

## 변경 범위

### 신규: `src/lib/deposit/`

1. **`depositIdempotencyCache.ts`**
   - `getOrMintIdemKey(scope, payloadHash)` — localStorage `phonara:dep:idem:{scope}` JSON `{key, hash, ts}`, 10분 TTL.
   - `isDuplicateInFlight(key)` — 같은 key가 cache에 있고 status≠filled 면 true.
   - `markIdemConsumed(key)` — TTL 즉시 만료.
   - `hashDepositPayload({method,amount,bank?,voucher?})` — SHA-256 8byte prefix.

2. **`depositToastDedupe.ts`**
   - module-scope `Map<intentId, ts>` + `BroadcastChannel('phonara:dep:fill')` 브로드캐스트.
   - `claimFilledToast(intentId): boolean` — 30s 내 첫 호출만 true. BroadcastChannel 으로 타 탭 suppression.
   - SW push와 페이지 양쪽에서 같은 키로 dedupe.

### 신규: `src/hooks/deposit/`

3. **`useDepositMonitoring.ts`**
   - PollingManager 어댑터: priority `high`, category `cosmetic`, baseMs 30_000.
   - intent active 동안만 register, filled/expired 시 unregister.
   - visibility는 PollingManager가 처리 → useDeposit 내부 `setInterval` 제거 대상 (옵션 props로 wiring만, FREEZE 파일 본문 변경 X).
   - **money-flow 가드**: register 시 category 강제 `"cosmetic"` (truth는 RPC가 책임, polling은 UX hint).

4. **`useManualDepositSync.ts`**
   - 한국 계좌이체/voucher → admin 처리 상태 동기화.
   - `deposit_requests` (해당 `id=eq.{id}`) realtime + BroadcastChannel `phonara:dep:manual:{id}` mutex.
   - 단일 탭만 RPC poll 수행 (leader election: `Date.now()+random` 최소값이 5s 내 broadcast 안 받으면 자기가 leader).
   - approved/rejected 상태 전이 시 1회만 toast (depositToastDedupe 재사용).

5. **`useFillBroadcast.ts`**
   - 가벼운 어댑터: `useDepositRealtime`의 `onFilled` 콜백 안에서 `claimFilledToast(id)` 체크해서 fall-through 시 토스트/burst skip.
   - useDeposit 본문 변경 없이 콜백 합성용.

### 수정 (FREEZE 외)

6. **`src/components/empire/PhonaraPayPanel.tsx`**
   - `supabase.channel(...)` raw 호출 → `useWalletChannel`로 교체 (ESLint no-raw-channel 통과).
   - filled 처리 전에 `claimFilledToast(intent.id)` 게이트 → 다중 탭 dedup.
   - intent 필터 `filter:'id=eq.{id}'`로 좁혀서 모든 UPDATE 수신 폭주 제거.

7. **`src/packages/wallet/hooks/useDeposit.ts`** (FREEZE — **본문 무변경**)
   - 변경 금지. `useDepositMonitoring` wiring은 별도 PR에서. 이번 P0-7에서는 FREEZE 보호.
   - 대신 PhonaraPayPanel 경로만 폴링 가드 + dedup 적용.

### 문서

8. **`docs/operations/deposit-flow.md`** 신규
   - 입금 race 시나리오 (다중 탭, SW+page 동시 fill, manual transfer admin 승인 동기화)
   - Idempotency 키 라이프사이클 (10분 TTL, payload hash, 서버 dedup 관계)
   - Manual transfer leader election 동작
   - Toast dedup 메커니즘 (BroadcastChannel + module Map)

## 가드레일

- **money-flow 8경로 git diff = 0**: `useDeposit.ts`/`useDepositRealtime.ts` 등 FREEZE 파일 본문 무변경. `scripts/check-money-flow-freeze.mjs` PASS.
- **RPC wrapper만 사용**: `submit_deposit` / `create_crypto_deposit_intent` / `get_my_pending_deposits` 직접 변경 X.
- UI 변화 0 — 토스트 1회 보장 외 시각적 변화 없음.
- Layer 1 gz 영향 < 1KB (모두 lib/hook 신규, lazy 경로).
- 모든 push/realtime은 `use*Channel` 래퍼.

## 기술 노트

```text
PhonaraPayPanel (tab A) ──┐
                          ├── BroadcastChannel('phonara:dep:fill') ──► claimFilledToast(id)
PhonaraPayPanel (tab B) ──┘                                              │
                                                                         ▼
SW push 'deposit_filled' ───────────────────────────────────────────► 1회만 toast
```

```text
Manual transfer (bank/voucher):
  tab A elects leader → polls admin status every 30s (PollingManager)
  tab B listens BroadcastChannel('phonara:dep:manual:{id}')
  leader leaves → next tab elects after 5s heartbeat timeout
```

## 파일 목록

- 신규: `src/lib/deposit/depositIdempotencyCache.ts`
- 신규: `src/lib/deposit/depositToastDedupe.ts`
- 신규: `src/hooks/deposit/useDepositMonitoring.ts`
- 신규: `src/hooks/deposit/useManualDepositSync.ts`
- 신규: `src/hooks/deposit/useFillBroadcast.ts`
- 수정: `src/components/empire/PhonaraPayPanel.tsx` (raw channel → wrapper + dedup)
- 신규: `docs/operations/deposit-flow.md`

## 다음 (P0-8 예고)

세션/인증 안정화 (token refresh race, multi-tab session sync, 401 자동 복구).
