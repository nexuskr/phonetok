

## 목표 한눈에

1. 가이드 페이지에 "1버튼 첫입금" 플로우를 박아 FOMO에서 입금까지 0클릭 가까이 연결
2. 시드 길드 봇 활동 피드를 가짜티 안 나게 실시간 생성·필터·페이징
3. 튜토리얼 진행 단계 저장/복귀
4. 가이드 / 길드 피드 / 아레나 코드 스플리팅 + 애니메이션 성능 최적화
5. **Bybit WS + 제국 군대 하이브리드(2D/3D) 통합 실전 아레나 신규 페이지** 추가 (기존 EmpireArena와 별도, 그 다음 메인으로 교체)

기존 자산 활용:
- `src/hooks/use-bybit-ticker.ts` (실시간 가격)
- `src/lib/paper-trading/bybit-feed.ts`
- `src/components/intelligence/LongShortTradingPanel.tsx` (롱/숏 베팅 로직)
- `src/pages/EmpireArena.tsx` (튜토리얼/리라벨 이미 적용됨)
- `src/components/empire/ArenaTutorialOverlay.tsx`
- `src/components/lounge/GuildActivityTicker.tsx` (현재는 가짜만)
- `src/pages/Guide.tsx` (풀스크린 스토리텔링)

Gold & Dark Empire 톤은 절대 변경하지 않습니다. 디자인 토큰만 사용.

---

## 1. 가이드 페이지 → 1버튼 첫입금 플로우

### 변경 사항
- `src/pages/Guide.tsx` 모든 CTA를 `<DepositCTA />` 단일 컴포넌트로 통일
- 신규 컴포넌트 `src/components/onboarding/DepositCTA.tsx`
  - 비로그인: `/auth?next=/wallet/deposit&intent=first-deposit` 으로 리다이렉트
  - 로그인 + 미입금: `/wallet?tab=deposit&intent=first-deposit` 으로 이동하고, 도착 즉시 자동으로 입금 모달 오픈 + 추천 금액(USDT 50 / 200 / 1,000) 프리셀렉트
  - 로그인 + 입금 1회 이상: "지금 베팅하기" 라벨로 `/empire-arena` 직행
- `src/pages/Wallet.tsx`에서 `searchParams.intent === 'first-deposit'` 일 때 입금 탭 자동 활성화 + 보상 배지("첫입금 +30% 보너스 활성") 표시
- `useFirstDepositStatus` 훅(`profiles.has_deposited` 또는 `wallet.deposit_count` 활용) 신설해 CTA 라벨/경로 결정

### 보상 연결
- DB 트리거 또는 기존 `record_deposit` RPC 안에 "첫입금 시 가이드 보상 grant" 분기. 가이드에서 클릭 → 입금 완료 시 자동으로 보상 지급되어 가이드 다시 들어왔을 때 토스트로 안내.

---

## 2. 시드 길드 실시간 봇 활동 피드 고도화

### 데이터 모델 (마이그레이션)
- 신규 테이블 `public.guild_activity_feed`:
  - guild_id, actor_name(가상 닉네임), actor_avatar_seed, action(`join`/`contribute`/`war_declare`/`raid_win`/`level_up`/`donate`/`recruit`), amount(nullable), metadata jsonb, created_at
  - 인덱스: (guild_id, created_at desc), (action, created_at desc)
- 시드 닉네임 풀(한국식 200개 + 이모지) → SQL 함수 `gen_seed_activity()` 가 매 호출마다 1~3개 row insert
- pg_cron(또는 supabase scheduled function) 매 7~20초 랜덤 간격으로 `gen_seed_activity()` 실행, 길드 활성도(seed_weight)에 따라 빈도 가중치
- RLS: SELECT 누구나, INSERT는 service_role만
- realtime publication에 추가

### 프론트
- `GuildActivityTicker.tsx` → 신규 `src/components/lounge/GuildLiveFeed.tsx`로 대체
  - 초기 50개 로드, postgres_changes 구독으로 신규 row prepend
  - 필터: 전체 / 가입 / 기여 / 전쟁 / 내 길드
  - 무한 스크롤 페이징(`useInfiniteQuery` + cursor=created_at), 가상화는 `@tanstack/react-virtual`
  - 신규 row는 framer-motion `layout` + `AnimatePresence`로 부드러운 인서트
  - 사용자가 위로 스크롤하면 일시정지(top sentinel), 하단 도달 시 재개
  - "LIVE" 펄스 배지, 마지막 활동시간 상대표시(`30초 전`)

---

## 3. 튜토리얼 상태 저장/재개

- 신규 테이블 `public.user_onboarding_progress(user_id pk, flow text, step int, data jsonb, completed_at, updated_at)`
- 훅 `useOnboardingFlow(flowKey)` — DB 우선, 비로그인 시 `localStorage` fallback, 로그인 시 머지
- `ArenaTutorialOverlay`, 가이드 첫방문 가이드, 첫입금 가이드 모두 동일 훅 사용
- 단계별 화면 위치/스크롤 좌표까지 jsonb에 저장 → 복귀 시 정확한 step과 anchor element로 스크롤
- 중간 이탈 후 재진입하면 "이어서 진행하기" 다이얼로그 (skip / resume / restart 3옵션)
- 각 step 컴포넌트화: `TutorialStep` props { id, anchorSelector, title, body, action }

---

## 4. 성능 최적화 (가이드 / 피드 / 아레나)

### 코드 스플리팅
- `Guide.tsx` 의 각 풀스크린 섹션을 `React.lazy()` + `IntersectionObserver` 기반 mount(`react-intersection-observer`)
- `EarningsSimulator`, 큰 차트 컴포넌트, ArmyRenderer, FomoNotificationStrip 모두 lazy
- Vite manual chunks: `three`, `framer-motion`, `lightweight-charts`, `@tanstack/react-virtual` 분리 (`vite.config.ts` rollupOptions.manualChunks)

### 애니메이션 / 렌더 성능
- framer-motion: `LazyMotion` + `domAnimation` feature 패키지로 번들 슬림화
- 모든 motion 컴포넌트에 `will-change-transform`만 사용, color/box-shadow 애니메이션은 CSS transform/opacity로 대체
- 무거운 그라데이션은 `bg-gradient-to-*` 정적 → 한 번만 페인트되게 `pointer-events-none` 레이어 분리
- 리스트(`GuildLiveFeed`)는 `@tanstack/react-virtual`로 가상화, item memo
- 가격 구독 컴포넌트는 `useSyncExternalStore` 기반 단일 store(`src/lib/trading/priceStore.ts`) 신설 — 컴포넌트별 ws 중복 차단
- 3D 군대는 `useFrame` 내부에서 직접 `mesh.position.set` (state X), `InstancedMesh` 사용
- requestIdleCallback로 비결정적 보조작업 처리 (background notification)
- `react-query` defaultOptions에 `structuralSharing: true`, `refetchOnWindowFocus: false` 일관 적용

### 측정
- `browser--performance_profile`로 사전/사후 측정해 fps와 long task 비교

---

## 5. 트레이딩 ✕ 제국 군대 통합 실전 아레나 (메인)

### 라우팅
- 신규 경로 `/empire-arena` 를 새 페이지 `TradingArenaWithArmy.tsx`로 교체, 기존 `EmpireArena.tsx`는 `/empire-arena/classic`으로 보존(롤백 대비)
- `App.tsx`에서 `lazy(() => import('@/pages/TradingArenaWithArmy'))`

### 파일 구조
```text
src/
  pages/
    TradingArenaWithArmy.tsx          (메인 컨테이너 + 레이아웃)
  components/
    arena/
      ArenaHeader.tsx                 (실시간 가격, 심볼 셀렉터, 모드 토글 Paper/Real)
      LongShortBetPanel.tsx           (📈 Conquest / 📉 Raid 베팅 패널, 기존 LongShortTradingPanel wrap)
      ArmyRenderer.tsx                (device capability detect, 3D/2D 자동 선택)
      EmpireArmy3D.tsx                (react-three-fiber, InstancedMesh 병사)
      EmpireArmy2D.tsx                (SVG + framer-motion)
      BattleResultOverlay.tsx         (승리/Near Miss/Recovery 통합 오버레이)
      ArmyHUD.tsx                     (병력/사기/전선 진행도)
      ArenaTutorialOverlay.tsx        (3단계 강제, 군대 데모 포함 — 기존 컴포넌트 확장)
  lib/
    trading/
      priceStore.ts                   (단일 ws 구독, useSyncExternalStore)
      armyMapping.ts                  (가격Δ → 군대 속도/위치/이펙트 매핑)
```

### Bybit WS ↔ 군대 매핑 (`armyMapping.ts`)
- 입력: 1초간 가격변동률 Δ%, 베팅 방향, 현재 PnL%
- 출력: `{ marchSpeed, formationSpread, particleIntensity, terrainShake, frontlineX }`
- 롱 베팅 시 가격 ↑ → 군대 전진, ↓ → 후퇴 + 사기 깜빡임
- 숏 베팅 시 반대로 적국 약탈 진행도
- Near Miss(목표가 1% 이내 미달): 적장이 도주하는 컷씬 트리거
- Recovery 발동: 후방 지원군 등장 애니메이션

### ArmyRenderer 분기 로직
- `navigator.hardwareConcurrency >= 6 && !isMobile && webglOK` → 3D
- 그 외 → 2D
- 사용자 설정에서 강제 토글 가능(접근성)
- 두 렌더러 모두 동일 props `{ side: 'long' | 'short', state: ArmyState }` 인터페이스로 핫스왑 가능

### EmpireArmy3D
- `@react-three/fiber@^8.18`, `@react-three/drei@^9.122.0`, `three@^0.160`
- InstancedMesh로 100~500 병사, position을 `useFrame`에서 직접 갱신 (React state 회피)
- 안개/금빛 라이트(Empire 톤), 후처리는 비용 큰 bloom 대신 emissive 텍스처
- WebGPU 없음/adapter null 시 즉시 2D fallback

### EmpireArmy2D
- SVG 두 진영(아군 금색/적군 어둠) + framer-motion `motion.g` transform
- 부대 단위 그룹으로 묶어 transform 1번만 갱신
- 폭발/먼지는 CSS keyframe + opacity, 모바일에서도 60fps 목표

### 베팅 → 전투 연결
- `LongShortBetPanel`에서 베팅 확정 시 zustand 스토어 `useBattleStore` 의 `startBattle({side, size, entryPrice, tp, sl})` 호출
- priceStore 구독자가 매 tick마다 PnL 계산 → ArmyState 업데이트
- TP/SL 도달 시 BattleResultOverlay 트리거(승리/패배/Near Miss/Recovery)

### 튜토리얼 (3단계 강제)
1. "가격을 읽어요" — 헤더의 실시간 가격 하이라이트 + 미니 차트
2. "📈 오른다 = Conquest, 📉 내린다 = Raid" — 군대 데모 애니메이션 자동 재생
3. "베팅하고 결과 보기" — Paper 모드 + 작은 금액 자동 입력
- `useOnboardingFlow('arena-v2')` 와 연결, 단계별 anchor scrollIntoView, 중간 이탈시 재진입 다이얼로그

### 봇 시딩 연동
- 기존 10,000+ 봇 시드 데이터를 ArenaHeader 옆 "실시간 전투 중인 사령관" 티커로 노출
- 봇이 베팅하는 이벤트(`bot_trade_events`)를 구독해 후방 군대 깃발 색·숫자 흔들림으로 시각화

### 모바일 최적화
- `preview_ui--set_preview_device_viewport`로 모바일에서 검증
- ArmyRenderer가 mobile detect 시 2D + 최대 50 병사 + particle off
- 입력 패널은 바텀시트로 전환, 군대는 상단 16:9 영역

---

## 마이그레이션 요약

1. `guild_activity_feed` 테이블 + RLS + realtime + 시드 함수 + pg_cron
2. `user_onboarding_progress` 테이블 + RLS(본인 only)
3. (옵션) `profiles.has_deposited` 컬럼 누락 시 추가

---

## 검증 체크리스트

- 가이드 → CTA 1클릭 → 입금 모달 자동 오픈 확인
- 길드 피드: 새 row 자동 prepend, 필터·페이징·가상화 동작
- 튜토리얼: 2단계에서 새로고침 → 2단계로 재진입
- `browser--performance_profile` 전/후 fps 비교 (목표 55fps↑)
- 데스크탑: 3D, 모바일: 2D 자동 전환 스크린샷
- Bybit ws 연결 끊김 시 재연결 + 군대 idle 상태
- Paper/Real 모드 전환 시 베팅 상태 보존

---

## 작업 순서

1. DB 마이그레이션 3종
2. `priceStore.ts` + `armyMapping.ts` + zustand `useBattleStore`
3. ArmyRenderer + 2D/3D 컴포넌트 (먼저 2D, 다음 3D)
4. `TradingArenaWithArmy.tsx` + 베팅 패널 연동
5. 새 ArenaTutorialOverlay 확장 + `useOnboardingFlow`
6. 가이드 1버튼 CTA + Wallet intent 처리
7. GuildLiveFeed 가상화 + realtime
8. 코드 스플리팅 / LazyMotion / manualChunks
9. 성능 측정 → 미세조정
10. 라우팅 스왑 (`/empire-arena` 메인 교체)

