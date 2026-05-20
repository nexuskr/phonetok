# Auth Flow — Phonara (P0-3 갱신)

## 단일 진입점

```
┌──────────────────────────────────────────────────────────────┐
│  Supabase auth.onAuthStateChange (single subscription)       │
│                          │                                   │
│                          ▼                                   │
│  invalidateSessionCache() → verifySessionOnce() (5s TTL)     │
│                          │                                   │
│        ┌─────────────────┼──────────────────┐                │
│        ▼                 ▼                  ▼                │
│  useAuthBridge     useAuthReady        useRequireAuth        │
│  (DB sync +        (isReady,           (redirect guard +     │
│   persona +        hasSession)         returnTo 보존)         │
│   device)                                                    │
└──────────────────────────────────────────────────────────────┘
```

## 핵심 모듈

| 파일 | 역할 |
|---|---|
| `src/lib/auth/authSingleFlight.ts` | `verifySessionOnce()` — `/user` 호출 1회로 압축 |
| `src/lib/auth/refreshMutex.ts` | `safeRefreshSession()` — 동시 refresh mutex + exp backoff (500/1k/2k/4k) |
| `src/lib/auth-recovery.ts` | `isInvalidSessionError`, `clearBrokenLocalSession` (bad_jwt 감지) |
| `src/hooks/use-auth-bridge.ts` | 프로필/지갑 sync, persona, device 등록 (INITIAL_SESSION 이벤트 우선) |
| `src/hooks/use-auth-ready.ts` | `{ isReady, hasSession }` — verifySessionOnce 위임 |
| `src/hooks/use-require-auth.ts` | redirect loop guard + `returnTo` 쿼리 |
| `src/pages/Auth.tsx` | 인증 상태에 따라 `/dashboard` 또는 `/secure-auth` 로 분기 |
| `src/components/auth/AuthErrorBoundary.tsx` | bad_jwt throw → 자동 재연결 → 실패 시 재로그인 CTA |

## P0-3 변경점

1. **/user 호출 압축**: 페이지 1회 진입 시 3~5회 → **1회** (single-flight 5s TTL)
2. **refresh race 제거**: 동시 N개 → **1개 mutex Promise** 공유. 실패 시 exp backoff 4회.
3. **redirect loop guard**: `useRequireAuth` 가 `/auth`, `/secure-auth`, `/auth/callback`, `/forgot-password`, `/reset-password` 경로에서 nav 호출 skip.
4. **returnTo 보존**: 비인증 상태에서 protected route 진입 시 `?returnTo=<원래경로>` 부여. (SecureAuth 측 처리 필요 시 후속 PR.)
5. **Auth.tsx 인증 분기**: 이미 verified session 보유 시 즉시 `/dashboard` — 더 이상 SecureAuth 거쳐 튕기지 않음.
6. **AuthErrorBoundary**: bad_jwt 예외 자동 흡수 → 3s 후 silent recover. 비-auth 에러는 상위 ErrorBoundary 에 그대로 전달.
7. **INITIAL_SESSION 이벤트 의존**: Supabase v2 가 자동 발사하는 INITIAL_SESSION 을 1차 진입점으로 활용. `getSession()` 폴백은 single-flight 캐시 사용.

## 디버깅

- `/user` 403 폭주 시: `src/lib/auth/authSingleFlight.ts` 의 `cached` / `inflight` 확인. `verifySessionOnce()` 가 1회만 호출되는지 DevTools Network 탭에서 검증.
- 무한 리다이렉트 시: `useRequireAuth` 가 보고 있는 `location.pathname` 이 `AUTH_ROUTES` 에 포함되는지 확인.
- bad_jwt 즉시 재현: 다른 origin 의 localStorage 로 cross-storage 침투. 1회 보정 후 `clearBrokenLocalSession()` 가 자동 호출되어야 함.

## 비-범위

- OAuth provider 추가 (현행 Google/Email 유지)
- MFA AAL2 로직 변경 (`AdminAal2Gate`, `request_withdrawal` 스텝업 그대로)
- 백엔드 RL (인프라 미비 — `no-backend-rate-limiting` directive)
