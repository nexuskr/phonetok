# Phase 2 Pre-Flight — 3 Checks + Interval Registry

Phase 1 (OLD ARCHITECTURE 봉쇄) 완료. Phase 2 (Runtime Detox) 본작업 진입 전에 "감으로 제거"를 방지하기 위한 **계측·기준선·머니플로우 보호** 작업만 먼저 정리한다. 이 단계에서는 기존 `setInterval`을 **하나도 교체하지 않는다** — 측정 도구와 안전망만 깐다.

## 결과물

1. Money-flow interval 인벤토리 (코드 변경 X, 문서만)
2. `globalIntervalRegistry` — 모든 신규 interval 추적·강제 해제·진척도 측정
3. Background RPC baseline snapshot — Phase 2 -70% KPI 측정의 기준점
4. 교체 런타임 훅 3종 준비 상태 검증 + 부족분 보강

## 1. setInterval 인벤토리 (현재 78개 호출, 약 70개 파일)

전수 스캔으로 파악된 분포 — Phase 2에서 어디부터 손대지 **말아야 하는지**가 더 중요하다.

### 1-A. Money-flow 연결 — FREEZE (Phase 2에서 손대지 않음)

| 위치 | 주기 | 역할 |
|---|---|---|
| `packages/wallet/hooks/useDeposit.ts:173` | 30s | pending deposit 폴링 |
| `packages/wallet/hooks/useDepositRealtime.ts:69` | — | 입금 realtime 보조 |
| `packages/wallet/hooks/useDepositCountdown.ts:22` | 1s | 입금 카운트다운 |
| `lib/paper-trading/bybit-feed.ts:234/238/376` | ping/pong/5s | 가격 피드 — 베팅 직결 |
| `components/crash/hooks/useCrashRound.ts:21` | 1.5s | Crash 라운드 폴링 |
| `components/trading/MegaOrderPanel.tsx:81` | — | 주문 패널 |
| `hooks/use-kill-switches.ts:71` | 60s | 거래/출금 차단 스위치 |
| `hooks/use-auto-bet.ts:26` | 3.5s | AUTO REPEAT 베팅 |

→ PHON freeze 규칙 그대로 적용. read-only handling.

### 1-B. UI/Cosmetic 카운트다운·티커 — Phase 2 1차 타겟

`PayoutTicker`, `LivePurchaseTicker`, `MachineFomoTicker`, `VipArrivalsTicker`, `ImperialStoryRail`, `WorldDominationWall`(5s/5min/8s 3개), `TopEmperorBanner`, `TournamentCountdownBar`, `LiveCounterStrip`, `JackpotEmpireBanner`, `GhostPulseGlobe`, `LiveStats`, `AttendanceCard`, `VipBoostCard`, `AuthSocialProof`(5개), `OnboardingV3`, `ThreeMinuteCashLoop`, `JourneyMap`, `KpiGridV3`, `EmpireFX`, `LiveCounterRow`, `Guide` 페이지(3개), `CountdownLossAversion`, `WinCelebrationOverlay`, `SlotTournamentBanner`(2개), 슬롯 오버레이 2개, `LiveTicker`(`@pkg/live`).

→ `setVisibleInterval` / `runIfVisible` / `runAfterFirstInteraction` 로 강제 이주 대상.

### 1-C. 관리자 패널 — Phase 2 후순위

`KernelObservability`, `OracleFortress`, `PhaseCMetricsPanel`, `EconomyDashboard`, `StressTestDashboard`, `RiskEngineDashboard`. operator 분리 시 같이 처리.

### 1-D. 이미 처리된 것 (whitelist)

`lib/util/visible-interval.ts:37` (구현 본체), `hooks/use-now-tick.ts` (단일 글로벌 틱), `hooks/use-realtime-channel.ts:258` (realtime 폴링 fallback).

## 2. globalIntervalRegistry (신규)

**파일:** `src/packages/performance/intervalRegistry.ts`

- 모든 신규 interval은 `trackInterval(id, meta)` 로 등록 — `{ owner, intervalMs, category, createdAt, stack? }`
- `setVisibleInterval` / 신규 헬퍼는 내부에서 자동 등록
- `killAll(category?)` — 카테고리 단위 강제 해제 (SYSTEM_DEGRADE 시 cosmetic 전체 차단)
- `getRegistrySnapshot()` — 현재 살아있는 interval 목록, dev 패널·텔레메트리에서 조회
- `getMigrationProgress()` — 등록된 interval / 총 setInterval 호출 수 비율 → Phase 2 진척도 KPI

**Dev-only UI:** `import.meta.env.DEV` 일 때 우측 하단 작은 칩으로 "live intervals: N (tracked: M)" 표시. 클릭 시 표.

**Telemetry:** `telemetry.event("interval.registry.snapshot", { tracked, untracked, byCategory })` 5분에 1회.

## 3. Background RPC baseline snapshot

Phase 2 핵심 KPI는 **-70% background RPC**. 기준선 없으면 측정 불가.

**파일:** `scripts/rpc-baseline.mjs` + `reports/rpc-baseline-2026-05-16.json`

- 빈 세션 로그인 → /dashboard 5분 idle → background 탭 5분 → 다시 active 5분
- 측정 항목:
  - 총 RPC 호출 수 / 분
  - RPC 별 호출 횟수 (top 20)
  - tab.hidden 동안 호출 수 (이게 핵심 누수)
  - realtime 채널 수
- 기록 후 PR 본문에 첨부 → Phase 2 종료 시 동일 시나리오로 재측정해 -70% 검증

**보조:** `@pkg/telemetry` 에 `rpc.call` 이벤트 sampling 추가 (8% rule). 클라이언트 측 자체 카운터로도 교차 검증.

## 4. 교체 런타임 훅 준비 상태

| 헬퍼 | 위치 | 상태 |
|---|---|---|
| `runWhenIdle` | `@pkg/performance/runtime.ts` | OK |
| `runIfVisible` | 동일 | OK |
| `runAfterFirstInteraction` | 동일 | OK |
| `runIfHighEndDevice` | 동일 | OK |
| `setVisibleInterval` | `lib/util/visible-interval.ts` | OK — 단 registry 연동 필요 |
| `useVisibleInterval` | 동일 | OK |
| **부족** `trackInterval` | (신규) | 본 작업에서 추가 |
| **부족** `setVisibleTimeout` | (신규, 1회성 visible-aware) | 본 작업에서 추가 |

→ `setVisibleInterval` 내부에서 `trackInterval` 호출하도록 한 줄 추가, `@pkg/performance` index에서 `setVisibleInterval` 도 re-export 해 import 경로 단일화.

## 5. Exit 조건 (이 PR 완료 기준)

- [ ] `src/packages/performance/intervalRegistry.ts` 동작 + dev 칩 표시
- [ ] `setVisibleInterval` 가 자동 등록
- [ ] `scripts/rpc-baseline.mjs` 실행 가능 + `reports/rpc-baseline-*.json` 1건 커밋
- [ ] `.lovable/plan.md` 의 Money-flow FREEZE 목록 = `eslint.config.js` 의 wallet/trading 보호 경로와 일치 검증
- [ ] 기존 `setInterval` 호출은 **수정 없음** (Phase 2 1차에서 진행)
- [ ] PR 템플릿 체크리스트에 "interval registry 등록 여부" 1줄 추가

## 6. 비-목표 (이 PR에서 하지 않음)

- 실제 `setInterval` → `setVisibleInterval` 이주 (= Phase 2 본작업)
- Money-flow interval 리팩터 (= PHON FREEZE)
- 관리자 패널 interval 처리 (= Phase 8 operator 분리와 묶음)
- 번들 다이어트, 가상화 (= Phase 5)

## 기술 메모

- registry는 WeakRef 없이 일반 Map — 컴포넌트 unmount 시 cleanup 호출이 정상이면 leak 없음. 누락 추적용으로 `createdAt` 비교해 600s 초과 항목은 텔레메트리 경고.
- baseline 스크립트는 Playwright 의존 추가하지 말고, 이미 있는 `scripts/v3-2-stress.ts` 패턴(headless 없이 수동 실행) 따라가서 단순화. 측정은 `performance.getEntriesByType("resource")` + `supabase.functions.invoke` 래퍼 카운터.
- dev 칩은 production 번들에서 tree-shake 되도록 `if (import.meta.env.DEV)` 가드.
