# Auth / Session Flow (P0-3 → P0-8 final)

본 문서는 Phonara 클라이언트의 인증/세션 안정화 레이어 최종본을 정리한다.
**money-flow 8경로와 무관** — 모든 변경은 client-side 만.

## 레이어 구성

```text
                supabase.auth (SDK)
                        │ onAuthStateChange
                        ▼
   src/lib/auth/
    ├─ authSingleFlight.ts   (verifySessionOnce, 5s TTL)
    ├─ refreshMutex.ts       (safeRefreshSession, backoff + metrics)
    ├─ authBroadcast.ts      (BroadcastChannel phonara:auth)
    ├─ sessionHealth.ts      (refresh ring + peer + 401 cnt)
    └─ recover401.ts         (recoverFrom401 wrapper)

   src/hooks/
    ├─ use-auth-bridge.ts        (App 루트 · 세션 동기화)
    └─ auth/useMultiTabAuthSync  (App 루트 · 멀티탭 동기화)
```

## 1. Single-flight session verification (P0-3)

`verifySessionOnce()` — 페이지 진입 시 `/user` 호출을 1회로 압축.
- In-flight Promise 공유
- 5s TTL 캐시
- 모든 `onAuthStateChange` 이벤트에서 자동 invalidate

## 2. Refresh mutex + backoff (P0-3 + P0-8 계측)

`safeRefreshSession()` — 동시 refresh single-flight + 4회 exponential backoff
(500/1000/2000/4000ms + jitter).
- P0-8: 성공/실패가 `sessionHealth.recordRefresh()` 에 기록되어 admin 패널에서 가시화.

## 3. Multi-tab broadcast sync (P0-8 신규)

`BroadcastChannel('phonara:auth')` 단일 채널.

| 이벤트 | 전파자 | 수신 탭 동작 |
|---|---|---|
| `SIGNED_IN` | 로그인한 탭 | cache invalidate |
| `SIGNED_OUT` | 로그아웃한 탭 | cache invalidate + local store user=null |
| `TOKEN_REFRESHED` | refresh 한 탭 | cache invalidate (+ heartbeat 용도 겸용) |
| `RECOVER_401` | 401 복구 성공 탭 | cache invalidate |

- 자기 탭 echo 는 `tabId` 비교로 차단.
- 강제 `location.reload()` 없음 — Supabase SDK 가 자동으로 다른 탭에도 SIGNED_OUT
  이벤트를 발사하므로, 우리는 즉시 로컬 store 만 정리하고 자연스러운 라우팅에 맡긴다.
- 미지원 환경 (SSR / 일부 in-app webview) 은 모두 no-op.

### Multi-tab 시나리오

1. **탭 A 로그아웃 → 탭 B 즉시 반영**
   - A: `supabase.auth.signOut()`
   - A: `onAuthStateChange('SIGNED_OUT')` → `publishAuthEvent('SIGNED_OUT')`
   - B: `subscribeAuthEvents` 핸들러 → `invalidateSessionCache()` + local store clear
   - B: SDK 가 곧 `SIGNED_OUT` 자체 발사 → UI 가 비인증 상태로 자연스럽게 전환

2. **탭 A 401 복구 성공 → 탭 B 도 fresh 토큰 사용**
   - A: `recoverFrom401(fn)` 내부에서 `safeRefreshSession()` 호출
   - SDK 가 두 탭 모두에 `TOKEN_REFRESHED` 발사 + A 가 `RECOVER_401` broadcast
   - B: 다음 요청부터 새 access token 자동 사용

## 4. 401 silent recovery (P0-8 신규)

```ts
import { recoverFrom401 } from "@/lib/auth/recover401";

const data = await recoverFrom401(() => callMyRpc(args));
```

- 401 / bad_jwt 감지 시 `safeRefreshSession()` 1회 → 재실행
- 재실패 시 `supabase.auth.signOut({ scope: 'local' })` + `publishAuthEvent('SIGNED_OUT')`
- **scope: 'local'** 사용으로 서버 세션은 유지 → 다른 탭에 의도치 않은 로그아웃 전파 방지
- 카운터 (`recover401.success/failure`) 자동 누적

> **P0-8 범위:** wrapper 자체와 인프라까지만. 개별 RPC 호출부 적용은 **P1** 에서
> 핫스팟 우선으로 진행.

## 5. Session health observability (P0-8 신규)

`/admin/ops/session-health` (AAL2):
- 이 탭의 `TAB_ID`
- 활성 Peer 탭 수 (8s TTL heartbeat)
- Refresh history (최근 20건, OK/FAIL/duration/error)
- 401 복구 OK / Fail 카운터
- Last broadcast event (type / from tab / ts / meta)

## 6. useAuthBridge 강화 (P0-8)

`useMultiTabAuthSync()` 호출만 추가. 기존 mounted guard / single-flight / device
register / persona assign 흐름은 P0-3 그대로 유지.

## 가드레일

- money-flow 8경로 git diff = **0**
- 모든 신규 코드는 `src/lib/auth/*` / `src/hooks/auth/*` / `src/components/admin/ops/*`
  / `src/pages/admin/ops/*` 에만.
- Layer 1 gz 영향: SessionHealth UI 는 operator chunk 격리되어 사용자 번들 영향 0.
- `supabase.auth.signOut({ scope: 'local' })` 사용으로 다른 탭 의도치 않은 로그아웃 방지.
