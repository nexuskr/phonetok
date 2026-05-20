# Deposit Flow Stabilization (P0-7)

## 목표
입금/결제 흐름의 race · idempotency · 다중 탭 dedup · 모니터링 폴링을 철벽으로 안정화. 머니플로 8경로 RPC 본문 git diff = 0 (read RPC wrapper만 사용).

## 1. Idempotency 키 (client cache)

파일: `src/lib/deposit/depositIdempotencyCache.ts`

- 키: `localStorage[phonara:dep:idem:{userId}:{method}]`
- TTL: 10분
- payload hash = SHA-256(JSON({method, amount, bankAccount, voucherPin, voucherBrand}))[0..8byte]
- API
  - `getOrMintIdemKey(scope, hash)` — 같은 hash면 기존 키 재사용, 아니면 신규 UUID
  - `isDuplicateInFlight(scope, hash)` — 같은 hash + `status='pending'`이면 true
  - `markIdemStatus(scope, status)` — filled/rejected 시 TTL 즉시 만료
  - `hashDepositPayload(payload)` — 헬퍼

서버 dedup(`submit_deposit` / `create_crypto_deposit_intent`)이 최종 진실. 본 모듈은 사용자가 같은 화면에서 더블 클릭/탭 간 동일 제출 시 "이미 처리 중입니다" 안내를 표시하는 UX 레이어.

## 2. Toast Dedupe (cross-tab + SW)

파일: `src/lib/deposit/depositToastDedupe.ts`

- 30s 슬라이딩 윈도우 + `BroadcastChannel('phonara:dep:fill')`
- API: `claimFilledToast(id)` — 30s 내 같은 id에 정확히 1회 true
- 첫 호출자가 toast/burst, 나머지는 silent

### React 어댑터
파일: `src/hooks/deposit/useFillBroadcast.ts` — `useFillBroadcast()` → `claim(id)` 콜백.

## 3. 코인 입금 모니터링 폴링

파일: `src/hooks/deposit/useDepositMonitoring.ts`

`PollingManager`(P0-2) 어댑터:
- priority: `high`, category: `cosmetic` (강제)
- baseMs: 기본 30s (idle/bg/2g 배수 자동)
- terminal(filled/expired/canceled/rejected) 시 자동 unregister
- 머니플로 가드: category가 항상 cosmetic이라 `MoneyFlowDenyError` 미발생. 폴링되는 함수는 호출부가 반드시 read RPC wrapper여야 함.

기존 `useDeposit.ts`(FREEZE)는 본문 변경 없음.

## 4. 한국 계좌이체/voucher 수동 처리 sync

파일: `src/hooks/deposit/useManualDepositSync.ts`

다중 탭 leader election:
- `BroadcastChannel('phonara:dep:manual:{requestId}')`
- 2s마다 `{rank: Math.random(), ts}` 송신
- 최소 rank 또는 5s 무수신 → leader
- leader만 `deposit_requests` realtime UPDATE 구독
- terminal(approved/rejected/filled/completed/canceled) 시 `claimFilledToast('manual:{id}:{status}')`로 dedupe 후 `onResolved` 1회

```text
Tab A (rank=0.21) ──┐  heartbeat 2s
                    ├── BroadcastChannel('phonara:dep:manual:{id}')
Tab B (rank=0.87) ──┘
                    │
        leader = Tab A → realtime subscribe → resolved 시 claimFilledToast
        Tab A 닫힘 → 5s 후 Tab B leader 인계
```

## 5. PhonaraPayPanel 강화

파일: `src/components/empire/PhonaraPayPanel.tsx`

- raw `supabase.channel(...)` → `useWalletChannel({...})` 교체 (ESLint `no-raw-channel` 통과)
- bindings filter `id=eq.{intent.id}`로 좁혀 모든 UPDATE 폭주 제거
- filled 처리 직전 `claimFilledToast(row.id)` 게이트 → 다중 탭 중 1개 탭만 toast/burst

## 6. Race 시나리오 매트릭스

| 시나리오 | 해결 |
|---|---|
| 더블 클릭 (같은 탭) | `isDuplicateInFlight` true → "이미 처리 중" 토스트, RPC 미호출 |
| 두 탭 동시 제출 | 서버 idempotency_keys 거절 + `markIdemStatus('rejected')` |
| 코인 fill 시 두 탭 모두 UPDATE 수신 | `claimFilledToast(intent.id)` → 1탭만 토스트/burst |
| SW push + 페이지 동시 수신 | 같은 dedupe 키 → 1회 토스트 |
| 수동 입금 두 탭 polling 중복 | leader election → 1탭만 realtime, resolved toast 1회 |
| 백그라운드 탭 폴링 폭주 | `PollingManager`가 hidden 시 skip + idle 배수 |

## 7. 머니플로 가드레일

- `useDeposit.ts` / `useDepositRealtime.ts` 등 FREEZE 파일 git diff = 0
- 신규 모듈은 모두 read-only — write 경로는 `submit_deposit` / `create_crypto_deposit_intent` 기존 wrapper(`src/lib/deposits-rpc.ts`, `src/lib/phonaraPay.ts`)만 사용
- `scripts/check-money-flow-freeze.mjs` PASS 유지
