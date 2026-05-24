# 🧹 PHONARA 대청소 — One-Shot 실행 플랜

## 0. 절대 보존 (TOUCH 금지)
- `src/integrations/supabase/**` (client.ts, types.ts)
- `supabase/**` (config.toml, migrations, functions)
- `.env`, `.env.example`
- `src/components/ui/**` (shadcn primitives)
- `src/assets/**`

## 1. KEEP — 핵심만 남김

### 사용자 페이지 (8개)
```
src/pages/Index.tsx            →  /
src/pages/Auth.tsx, AuthCallback.tsx, ForgotPassword.tsx, ResetPassword.tsx  →  /auth/*
src/pages/Home.tsx (신규 또는 기존 유지)  →  /home
src/pages/Wallet.tsx                       →  /wallet
src/pages/Trade.tsx (Trading 핵심 1개)     →  /trade
src/pages/casino/Olympus1000.tsx           →  /slots
src/pages/Refer.tsx (또는 Referral)        →  /refer
src/pages/Account.tsx (또는 Profile)       →  /account
src/pages/NotFound.tsx                     →  *
```

### Admin 페이지 (1인 운영 최소 5개)
```
src/pages/admin/_AdminLayout.tsx           (shell)
src/pages/admin/AdminDashboard.tsx         (기본 통계)
src/pages/admin/Users.tsx                  (유저 관리)
src/pages/admin/Balances.tsx               (잔고 조정)
src/pages/admin/treasury/Withdrawals.tsx   (출금 승인)
src/pages/admin/Reports.tsx                (신고 모니터링)
```
→ 위 6개 외 `src/pages/admin/**` 전부 삭제 (AdminAudit, AdminRecovery, OpsReport, imperial/CommandCenter, ops/SessionHealth, ops/Sprint4Dashboard, _AdminAal2Chip, _AdminPendingBell, _AdminSidebar 등은 필요시 최소 stub로 통합).

### 패키지 (참고용 1개만)
- **KEEP**: `src/packages/wallet/**` (가장 정돈됨, money-flow 참고)
- **DELETE**: `core, ui, earn, game-engine, trade, live, avatar-nft, referral, analytics, performance, telemetry, realtime, operator, runtime, entropy, risk, duel, games, apex, native, workers`

### 인프라
- `src/components/nav/MobileShell.tsx` + `MobileBottomNav.tsx`
- `src/components/ui/sonner.tsx` + `toaster.tsx`
- `src/integrations/supabase/client.ts`
- `src/lib/utils.ts`, `src/lib/notify.ts` (기본 토스트 래퍼만)

## 2. DELETE 목록 (대량)

### 페이지 (40+)
- `src/pages/apex/**` (전체 디렉토리)
- `src/pages/casino/**` ← Olympus1000.tsx만 보존
- `src/pages/games/**` (Blackjack/Plinko/Roulette Imperial)
- `src/pages/{Whales,Live,LiveOverlay,Lobby,InfluencerLanding,CampaignRedirect,ReplayLanding,SafePublic,Status,Pay,Fairness,Earn,PhonHub,LegalDoc,Unsubscribe,ImperialDuelLobby}.tsx`
- `src/pages/admin/**` (위 KEEP 6개 제외)
- `src/pages/security/RecoverTotp.tsx`
- `src/pages/apex/community/**`, `src/pages/apex/events/**`, `src/pages/apex/games/**`

### 패키지
- `src/packages/{core,ui,earn,game-engine,trade,live,avatar-nft,referral,analytics,performance,telemetry,realtime,operator,runtime,entropy,risk,duel,games,apex,native,workers}/**`

### 컴포넌트 (도메인 잔재)
- `src/components/empire/**`, `src/components/lobby/**`, `src/components/slots/**` ← OlympusSlot만 보존
- `src/components/casino/CasinoLayout.tsx` 보존 (Olympus 의존)
- `src/components/admin/**` ← Withdraw 관련(WithdrawRequestsAdmin, treasury/*) + Users/Balances/Reports 외 전부 삭제
- `src/components/flow/FlowRouter.tsx` 보존
- `src/components/security/StepUpGate.tsx` 보존 (wallet 의존)

### lib (미사용 Phase 잔재)
- `src/lib/{crash,flywheel,leverage,crown,trustV2,practiceMode,glossary,imperialCircuitV2,displayCurrency,deviceFingerprint,walletRefresh,route-prefetch}.ts`
- `src/lib/auth/authSingleFlight.ts` 는 Auth.tsx 의존 → 보존
- `src/lib/flow/flowState.ts` 보존

### 테스트/문서/리포트/스크립트
- `src/__tests__/**`, `src/test/**`, `e2e/**`
- `docs/{duel,apex,phase4,phase5,sprint,proposals,independence}/**`
- `audit/**`, `reports/**`, `.lovable/memories/features/phase-6-eternal-dominion.md`
- `scripts/{chaos,load,phase4,oracle-chaos.ts,slot-sim.ts,check-no-crown-ui.mjs,check-slot-sound-routing.mjs,phase5-rollback.sql,check-rpc-drift.ts,security-lint.ts,rpc.surface.baseline.mjs}`
- `scripts/independence/**`
- `.github/workflows/{db-permissions,pr3-isolation,prerender,e2e}.yml`

## 3. 재작성

### `src/App.tsx`
```tsx
BrowserRouter
├─ Routes
│   ├─ /              Index
│   ├─ /auth/*        Auth flow
│   ├─ /home          Home (자리잡이 — 출석/미션 placeholder)
│   ├─ /wallet        Wallet
│   ├─ /trade         Trade (placeholder)
│   ├─ /slots         Olympus1000
│   ├─ /refer         Refer (placeholder)
│   ├─ /account       Account (placeholder)
│   ├─ /admin/*       AdminLayout (5 sub-routes)
│   └─ *              NotFound
├─ <MobileBottomNav />
└─ <Toaster />        (sonner)
```

### `eslint.config.js`
- 표준 typescript-eslint + react-hooks recommended
- `no-direct-sonner`, `no-raw-channel` 룰 제거 (관련 코드도 삭제됨)
- 빈 파일이었던 것 → 최소 권장 설정으로 초기화

### `.dependency-cruiser.cjs`
- apex/operator/duel/critical-no-optional 룰 전부 삭제
- `no-circular` 만 유지

### `vite.config.ts`
- 그대로 유지 (이미 깔끔). manualChunks만 supabase/icons/i18n 유지.

### `tsconfig.json`
- `@pkg/*` paths 전부 제거 (패키지 삭제됨)
- `@pkg/wallet` 1개만 유지

## 4. 실행 순서 (단일 턴)

```bash
# Step 1: 대량 삭제 (parallel rm -rf)
rm -rf src/pages/apex src/pages/games \
       src/pages/admin/imperial src/pages/admin/ops \
       src/__tests__ src/test e2e \
       docs/duel docs/apex docs/phase4 docs/sprint docs/proposals docs/independence \
       audit reports \
       src/packages/{core,ui,earn,game-engine,trade,live,avatar-nft,referral,analytics,performance,telemetry,realtime,operator,runtime,entropy,risk,duel,games,apex,native,workers} \
       src/components/{empire,lobby} \
       scripts/{chaos,load,phase4,independence}

# 개별 파일
rm src/pages/{Whales,Live,LiveOverlay,Lobby,InfluencerLanding,CampaignRedirect,ReplayLanding,SafePublic,Status,Pay,Fairness,Earn,PhonHub,LegalDoc,Unsubscribe,ImperialDuelLobby}.tsx
rm src/pages/security/RecoverTotp.tsx
rm src/pages/admin/{AdminAudit,AdminRecovery,OpsReport,_AdminAal2Chip,_AdminPendingBell,_AdminSidebar}.tsx
rm src/lib/{crash,flywheel,leverage,crown,trustV2,practiceMode,glossary,imperialCircuitV2,displayCurrency,deviceFingerprint,walletRefresh,route-prefetch}.ts
# casino: Olympus1000 제외 전부
find src/pages/casino -type f ! -name 'Olympus1000.tsx' -delete

# Step 2: 재작성
- src/App.tsx (신규 8 user + 5 admin 라우트)
- eslint.config.js
- .dependency-cruiser.cjs
- tsconfig.json (paths 정리)
- src/pages/{Home,Trade,Refer,Account}.tsx (placeholder 신규)
- src/pages/admin/{AdminDashboard,Users,Balances,Reports}.tsx (placeholder 신규)

# Step 3: 검증
bun run build  &  bun run lint
```

## 5. 산출물 보고
- 삭제된 파일 수 (목표 280+)
- 남은 src 파일 수 (목표 ~120)
- `bun run build` 결과 (성공/번들 크기)
- `bun run lint` 결과 (에러 수 — 목표 50 이하)
- 최종 디렉토리 트리 요약

## 6. 위험요소 & 대응
- **import 끊김**: 삭제된 페이지를 참조하는 컴포넌트가 있으면 빌드 깨짐 → App.tsx 재작성 시 모든 import 명시적으로 새로 작성, 잔여 컴포넌트는 grep으로 추가 정리.
- **Wallet 패키지 의존**: `src/packages/wallet`이 삭제된 패키지(`@pkg/core`, `@pkg/realtime` 등)를 import하면 빌드 깨짐 → 빌드 결과에 따라 추가 정리 또는 `src/packages/wallet`도 삭제하고 wallet 페이지를 placeholder로 대체.
- **Admin 컴포넌트 의존성**: WithdrawRequestsAdmin이 삭제된 admin 컴포넌트 import하면 빌드 깨짐 → 빌드 에러 따라 stub 처리.

## 7. 다음 턴
청소 완료 후 → 8개 핵심 페이지 본격 구현 + Admin 5개 기능 본격 구현.

---

**승인 시 즉시 build 모드 진입하여 한 턴에 모든 단계 실행합니다.**
