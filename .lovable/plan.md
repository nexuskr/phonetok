# 전 페이지 부드럽게 — Phase P (Mars-grade smoothness)

기존 Step 1~3에서 Dashboard / Layout만 잡았다면, 이제 **앱 전체**를 같은 수준으로 끌어올린다. 시각·기능·문구·디자인 토큰 변경 0건. 오로지 "느낌"만 바꾼다.

---

## 현황 (측정값)

- `setInterval` 사용처: **62곳** (30+ 컴포넌트)
- supabase realtime/subscribe: **76건**
- 페이지 수: 39개, 코드 약 10,380줄
- 모든 페이지 lazy-load 되어 있으나, **첫 진입 후 내부 컴포넌트가 동시 마운트 + 매초 setState** 패턴이 반복됨 → Dashboard와 동일 증상이 Wallet/Lounge/EmpireArena/Admin 등에서도 발생

---

## 목표 결과

- 모든 라우트 진입 후 **첫 페인트 ≤ 1.0s**, INP ≤ 200ms
- 매초 setState 컴포넌트: **앱 전체 0개** (모두 글로벌 tick 구독)
- 같은 supabase 테이블에 대한 중복 채널: **0건** (싱글톤 채널)
- 라우트 hover/visible 시 **prefetch** → 클릭 시 즉시 전환
- 모바일 (저사양 안드로이드 기준)에서도 60fps 스크롤

---

## 작업 계획

### Phase P1 — 글로벌 tick 통합 (effort: 중)

`src/hooks/use-now-tick.ts` 신설 (이미 plan만 있음 → 실제 구현). 단일 store가 1초·2초·5초·10초 4개 채널로 broadcast.

대상 (62개 interval 중 클럭성격만 치환, 비즈니스 로직 polling 제외):
- 카운트다운: `ActiveBoostCounter`, `EmpireFoundingCounter`, `BaronPromotionDialog`, `CountdownLossAversion`, `MissionDailyCapCard`, `WithdrawQueueStatus`, `StepUpGate`, `BattleResultOverlay`, `SixtySecondFlow`, `TrustCounter`
- 회전형 ticker는 P2에서 별도 처리

**효과**: 매초 9~15개 컴포넌트가 각자 setState → 단일 store 1회 setState로 통합. 리렌더 트리 80%↓.

### Phase P2 — Ticker / 회전형 컴포넌트 throttle (effort: 소)

- `LivePulseStrip`, `PayoutTicker`, `LiveRanking`, `LiveStats`, `LiveCounterRow`, `JackpotEmpireBanner`, `WhaleStrikeRail`, `LivePurchaseTicker`, `MachineFomoTicker`(이미 6.5s) → 회전 주기 5s 미만은 모두 8s로 통일
- `requestAnimationFrame` 기반 회전은 `IntersectionObserver`로 화면 밖이면 pause
- `prefers-reduced-motion` 시 회전 정지·고정 첫 항목

### Phase P3 — Realtime 채널 싱글톤화 (effort: 중)

`src/lib/realtime-bus.ts` 신설. 같은 테이블/필터 조합은 하나의 채널만 열고 콜백을 fanout. 76개 subscribe 중 중복 ~30% 제거 예상.

특히 빈도 높은 곳:
- `chat_messages`, `whale_strikes`, `crown_events`, `fomo_notifications`, `purchase_events`
- 관리자 채널은 `has_role` 검증 후에만 subscribe (Step 3에서 일부 처리됨, 나머지 admin 페이지에 확장)

### Phase P4 — 무거운 페이지 내부 LazyMount 확장 (effort: 중)

Dashboard에 적용한 `LazyMount` 패턴을 다음 페이지에 동일 적용:
- `Wallet.tsx` (690줄): 거래내역/차트/관리자 도구 영역 viewport-defer
- `EmpireArena.tsx`, `EmpireHall.tsx`, `Empire.tsx`: 랭킹/리플레이/통계 카드
- `Lounge.tsx`: 길드 패널/주간 정산
- `Admin.tsx` 탭 콘텐츠: 활성 탭 외 마운트 금지 (이미 일부 그러나 `useEffect` polling은 전부 살아있음)
- `TradingArenaWithArmy/Bybit`, `UgcDashboard`, `Settlements`, `Whales`, `Achievements`, `SeasonPass`, `Roulette`

### Phase P5 — 라우트 prefetch + 자산 최적화 (effort: 소)

- `src/components/Layout.tsx` 내 `<Link>`에 `onMouseEnter`/`IntersectionObserver` → `import()` prefetch
- 공용 무거운 자산 (`CommandHero` 1920×1080, Empire 배경) → `<link rel="preload" as="image" media="(min-width: 768px)">` + 모바일은 더 작은 변형
- 모든 `<img>` 기본 `loading="lazy"`, `decoding="async"` 보장
- vite `build.rollupOptions.output.manualChunks` — `framer-motion`, `recharts`, `lucide`, `@supabase`, `radix` 분리

### Phase P6 — 검증

- preview에서 `/dashboard`, `/wallet`, `/empire/hall`, `/lounge`, `/admin` 진입 후 Performance profile
- Long task > 50ms 0건 확인
- 콘솔 warning 0건
- 시각·기능 회귀 0건 (스크린샷 비교)

---

## 기술 세부

```
src/
  hooks/use-now-tick.ts      (신설: 글로벌 시계 store)
  lib/realtime-bus.ts        (신설: 채널 싱글톤)
  lib/lazy-mount.tsx         (기존 Dashboard 내부 → 공용으로 승격)
  lib/route-prefetch.ts      (신설: Link 호버 prefetch)
vite.config.ts               (manualChunks)
```

기존 컴포넌트는 **import 경로만 추가**, JSX/스타일은 건드리지 않는다 (`setInterval(fn, 1000)` → `useNowTick(1000, fn)` 1줄 치환).

---

## 산출물 / 보고

완료 시 `GitHub sync 완료 (auto)` + 변경 파일 목록 + Before/After 측정값(첫 페인트, long task, 매초 setState 컴포넌트 수) 보고.

승인하시면 Phase P1 → P6 순서대로 진행합니다.
