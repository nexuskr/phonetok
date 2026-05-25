
# 🚀 PHONARA V2 — One-Turn Launch Plan (God-Tier, Pragmatic)

## 0. 현실 정렬 (지존급 정직 점검)

마스터 디렉티브는 monorepo + 별도 admin 앱 + Bybit/Stake 풀스택을 요구하지만, **한 턴(≈90분)**으로 실제 빌드 가능한 범위는:

| Master spec | 1턴 현실 결정 |
|---|---|
| monorepo + apps/admin | **단일 프로젝트 유지**, `/admin/*` 라우트 격리 (이미 분리됨). monorepo 분할은 출시 후 PR-2 |
| 새 Supabase | **현 프로젝트 유지** — 기존 DB 보존 약속 |
| Bybit 풀 트레이딩 엔진 | **시뮬레이션 + 실시간 차트** (서버 RPC 없으면 클라 paper) |
| Stake 풀 슬롯 | **Olympus Lite** 5릴 클라 시뮬 + 잔액 연동 |
| Keepy-Uppy 미니게임 | **Canvas 60fps + 서버 점수 검증** 풀 구현 |
| 온보딩/FOMO/바이럴/Free-Earn | **풀 구현** (이게 핵심) |

→ 출시 가능한 **MVP-Premium**을 1턴에 끝낸다. monorepo/풀 트레이딩은 발사 후.

---

## 1. DB Foundation (Supabase migration)

**기존 테이블 절대 보존.** 신규 8개만 추가:

```sql
profiles(user_id PK→auth.users, nickname, avatar_url, ref_code unique, referred_by, created_at)
user_balances(user_id PK, phon numeric default 0, updated_at) -- 표시용
attendance_log(user_id, day date, reward int, unique(user_id,day))
missions(id, kind, title, reward int, daily bool, active bool)
mission_claims(user_id, mission_id, day date, unique)
referral_events(referrer_id, referee_id unique, reward_paid bool)
activity_feed(id, kind enum, masked_nick, amount, created_at) -- 라이브 마키 (관리자 seed + 트리거 자동)
game_scores(user_id, game text, score int, created_at)
```

**RLS**: `profiles` 본인 + public read (마스킹 닉만), 나머지 본인만. **트리거**:
- `auth.users` insert → profile 자동 생성 + signup 보너스 10,000 PHON + activity_feed insert
- `attendance_log` insert → balance 증가 + activity_feed
- `mission_claims` insert → balance 증가 + activity_feed

**RPC**:
- `claim_attendance()` — 일 1회, streak 계산, 보너스 반환
- `claim_mission(mission_id)` — daily 미션 idempotent
- `redeem_referral(code)` — 가입 시 최초 1회, 양쪽 보상
- `get_live_activity(limit)` — 라이브 피드 + 빈 경우 seed 폴백
- `submit_game_score(game, score, payload)` — 서버 검증 후 보상

---

## 2. 모바일 OS 디자인 시스템

`src/index.css` 토큰 전면 재설계 (HSL):
- **Base**: 다크 first `hsl(240 10% 5%)` / `hsl(240 5% 96%)`
- **Primary (Imperial Gold)**: `hsl(42 95% 58%)`
- **Accent (FOMO Pink)**: `hsl(340 85% 62%)`
- **Surfaces**: `--surface-1/2/3` glassmorphism + backdrop-blur
- **Gradients**: `--gradient-imperial`, `--gradient-fomo`, `--gradient-money`
- **Shadows**: `--shadow-glow-primary`, `--shadow-pop`, `--shadow-card`
- **Motion**: `--ease-ios cubic-bezier(.22,1,.36,1)`, `--dur-fast/base/slow`
- **Radius**: 1rem (iOS continuous)

`tailwind.config.ts`: 위 토큰 + keyframes (`count-up`, `pulse-glow`, `marquee`, `shimmer`, `sparkle-burst`, `fade-up`, `spring-in`) + `safe-top/bottom`.

`index.html`: `viewport-fit=cover`, `theme-color`, `apple-mobile-web-app-capable`, `body { overscroll-behavior:none; touch-action:manipulation }`.

---

## 3. 핵심 인프라 (신규)

```
src/lib/notify.ts          — sonner 4-tier 단일 진입점, gold glow
src/lib/format.ts          — formatPHON, formatKRW, mask nick
src/hooks/use-session.ts   — onAuthStateChange first, then getSession
src/hooks/use-profile.ts   — React Query, balance realtime
src/hooks/use-user-role.ts — has_role RPC 호출
src/hooks/use-haptic.ts    — navigator.vibrate 폴리필
src/components/auth/ProtectedRoute.tsx
src/components/feedback/CountUp.tsx       — 잔액 카운트업
src/components/feedback/PhonRain.tsx      — +PHON 플로팅 파티클
src/components/feedback/RewardBurst.tsx   — confetti lazy
src/components/layout/SafeArea.tsx
src/components/layout/MobilePageTransition.tsx (framer-motion)
src/App.tsx — QueryClientProvider + ProtectedRoute + AnimatePresence + Toaster
```

`@tanstack/react-query` + `framer-motion` + `canvas-confetti` 의존성 추가.

---

## 4. 인증 (`/auth`)

- Email/password + **Google OAuth** (`lovable.auth.signInWithOAuth("google")`)
- 단일 화면 토글 (Stake.com 톤), 풀스크린 다크 + gold glow
- 신규가입: ref 코드 입력 옵션 (자동 채움 from `?ref=`)
- `/auth/forgot` + `/auth/reset` 완성 (이미 존재 → 디자인만 톤 맞춤)
- 가입 즉시 트리거가 10k PHON 지급 → `/home` 리다이렉트 → **4-step 온보딩 자동 발사**

---

## 5. 4-Step Forced Onboarding (`<OnboardingGate>`)

App 루트 마운트. `profile.onboarded_at` null이면 풀스크린 시트, 비스킵.
1. **Welcome Burst** — +10,000 PHON CountUp + confetti, 3초 후 자동 다음
2. **First Mission** — "이 버튼 탭" → mission_claim → +500 PHON 파티클
3. **Referral Share** — 본인 ref 코드 표시 + Web Share / 카톡 / 복사 (액션 시 다음)
4. **Streak Activation** — claim_attendance + 🔥 streak flame 애니 + notification permission 요청

완료 시 `profiles.onboarded_at = now()`.

---

## 6. 8개 사용자 페이지 (실기능)

### `/` Index (Landing)
- 3초 후크 hero + 라이브 카운터 (`get_live_activity` 마키, 60s 갱신, framer-motion 무한)
- 가입 CTA + "이미 회원이세요?" 링크

### `/home` Dashboard (핵심)
- 상단: 잔액 카드 + CountUp + realtime 구독 (`user_balances`)
- **출석 카드** (오늘 클레임 / streak 🔥 / 다음 보상)
- **오늘의 미션** (3개 카드, 진행률, claim 버튼 → 보상 burst)
- **Mystery Box** (24h 쿨다운 — RPC mock)
- **Mini-Game CTA** → `/play/keepy`
- **친구 초대 카드** (내 ref 코드 + 1탭 공유)
- 하단 라이브 활동 피드 (realtime)

### `/play/keepy` Keepy-Uppy Mini-Game (신규 라우트)
- Canvas 60fps, 단일 손가락 터치, spring 물리
- 실패 시 즉시 리트라이 + 점수 표시
- 점수 → `submit_game_score` (서버 검증: max delta, time elapsed)
- 일일 보상 캡 3회

### `/trade`
- `lightweight-charts` BTC/ETH/SOL Bybit ticker fetch (5s)
- LONG/SHORT 2-button (대형 thumb-zone) + 금액 chip + leverage 슬라이더
- 포지션 시뮬 (클라 paper) + PnL realtime
- "실거래는 곧 오픈" 배너 (정직성)

### `/slots` (Olympus Lite)
- 5릴 SVG, spring 회전, anticipation 타이밍 (마지막 릴 +400ms)
- spin 버튼 (잔액 차감 → 결과 → 보상 burst)
- RTP ≈ 96% (클라 시뮬 + balance ledger)
- 잭팟 마키 상단

### `/refer`
- 내 ref 코드 큰 카드 + QR + 1탭 복사 + Web Share + 카톡 딥링크
- 누적 추천/보상 통계
- "친구가 가입하면 양쪽 +5,000 PHON" 카피

### `/wallet`
- 잔액 카드 (PHON + KRW 환산)
- 거래 내역 (activity_feed 본인 것)
- 입금/출금 → BottomSheet "준비중 — 베타 출시 임박" (출금은 기존 RPC 있으면 호출 시도)

### `/account`
- 프로필 (닉네임/아바타 편집, profiles.update)
- 알림/언어/테마 설정 (localStorage)
- 로그아웃, 법적 링크

---

## 7. 5개 Admin 페이지 (1인 운영)

`useUserRole('admin')` 가드. 미admin = 403.
- **AdminDashboard**: 6 KPI (오늘 가입/DAU/총 PHON 발행/오늘 출금 대기/Top 미션/이상감지 카운트) — 실 쿼리
- **AdminUsers**: 검색 + 테이블 + 동결/해제 (`is_account_frozen` 토글 if RPC exists)
- **AdminBalances**: 유저 검색 + 잔액 수동 조정 (audit log insert)
- **AdminWithdrawals**: 대기 큐 + 승인/반려 (`withdrawal_requests` 있으면 연결, 없으면 stub)
- **AdminReports**: activity_feed 이상값 + 신고 큐

---

## 8. 라이브 FOMO 시드 시스템

`activity_feed`는 빈 경우 클라 폴백 시드 마키 (마스킹 닉 + 보상 텍스트 10개 회전). DAU 낮아도 절대 빈 화면 없음.

---

## 9. 실행 순서 (단일 턴, 순차)

```
A. supabase--migration (DB 8 테이블 + RLS + RPC 5개 + 트리거 3개)
   ↓ 사용자 승인 대기 (이 1턴은 migration 승인이 게이트)
B. 토큰/Tailwind/index.html 모바일 OS 적용
C. 인프라 (notify, hooks, providers, ProtectedRoute, App.tsx)
D. Auth + Google OAuth 와이어업
E. OnboardingGate 4-step
F. 8 user 페이지 실기능 (Index, Home, Keepy, Trade, Slots, Refer, Wallet, Account)
G. 5 Admin 페이지 실데이터
H. MobileBottomNav 폴리시 + haptic
I. build/lint 검증 + 출시 publish 안내
```

---

## 10. 의존성
- `framer-motion`, `@tanstack/react-query`, `canvas-confetti`, `lightweight-charts`
- shadcn primitives 그대로

## 11. 보존 (불변)
- `src/integrations/supabase/**`, `.env`, `supabase/functions/**` 미수정
- 기존 마이그레이션 미수정 (신규만 추가)
- shadcn `src/components/ui/**` 미수정

## 12. 산출물
- 13 페이지 실작동
- DB 8 신규 테이블 + 5 RPC + 3 트리거
- 0 ESLint error, 0 TS error
- 번들 budget (index 180KB) 유지 시도
- 출시 가능 상태 → `<presentation-open-publish>`

## 13. 출시 후 (다음 턴)
- monorepo 분리 (`apps/web`, `apps/admin`)
- 실 트레이딩 RPC + 슬롯 서버 엔진
- Push (VAPID 이미 인프라 존재 시 연결)
- i18n ko/en/ja/vi
- Edge Functions: 일일 cron settle, fraud detection

---

**승인 시 → build 모드 진입 → migration 발사부터 시작 → 한 턴에 끝까지.**
